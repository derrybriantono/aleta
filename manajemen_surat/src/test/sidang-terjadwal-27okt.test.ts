// @vitest-environment node
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import { newDb } from "pg-mem";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { dalamJendela, msKeWita, witaKeMs } from "@/lib/putusan-terjadwal";
import {
  BATAS_SIDANG,
  bacaMuatanTersimpan,
  basKedaluwarsa,
  bersihkanMuatanTunda,
  periksaWaktuBas,
  periksaWaktuTunda,
  ringkasMuatan,
  susunWaktuSidang,
  tundaKedaluwarsa,
  tungguUlang,
} from "@/lib/sidang-terjadwal";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_SIDANG_TERJADWAL } from "@/server/db/schema";
import { akarPenyimpanan, bacaBerkas, hapusBerkas, simpanBerkas } from "@/server/modules/putusan-terjadwal/berkas";
import { ubahButir } from "@/server/modules/sidang-terjadwal/dasar";
import type { CekBas, DepsSidang, HasilBot, KeadaanSidang, MuatanUnggahBas } from "@/server/modules/sidang-terjadwal/deps";
import { buatTerjadwal, daftarTerjadwal, kelolaTerjadwal, type BerkasMasuk } from "@/server/modules/sidang-terjadwal/layanan";
import { bersihkanBerkas, detakPelaksana, kedaluwarsakan, pelaksanaNyala, pilihButir, pulihkanMacet } from "@/server/modules/sidang-terjadwal/pelaksana";
import { ApiError } from "@/server/shared/errors";

import { rtf } from "./putusan-terjadwal-bahan";

/**
 * ============================================================================
 * UNGGAH BAS TERJADWAL & TUNDAAN TERJADWAL (27 Okt 2026)
 * ============================================================================
 *
 * Menjalankan kodenya: aturan murni (waktu hari-sama untuk tunda, BAS >= hari sidang, muatan, jeda), migrasi
 * 0114 = DDL schema.ts, layanan atas basis data pg-mem (SEMUA ditolak bila satu tidak sah, hak, akun SIPP,
 * berkas BAS, daftar, batal/jadwal-ulang/ulang) dan pelaksana dengan SIPP/bot TIRUAN yang menjaga keadaannya
 * sendiri: urutan pengaman, tidak menimpa, tunda tidak pernah pindah hari, galat sementara diulang <= 4x,
 * jeda antar pekerjaan, jam kerja BAS, dan tidak ada kata ALETA di muatan yang dikirim ke SIPP.
 */

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

const wita = (t: string) => new Date(witaKeMs(t));
const TIDAK_LIBUR = async () => (_iso: string) => false;

// ─── 1. Aturan murni ─────────────────────────────────────────────────────────

describe("aturan waktu tunda (hari sama) dan BAS (>= hari sidang)", () => {
  const KINI = witaKeMs("2026-10-27 10:00");

  it("tunda: pada hari sidangnya, boleh lewat jam kerja (di atas 16.30), tidak boleh hari lain atau lampau", () => {
    expect(periksaWaktuTunda(witaKeMs("2026-10-27 10:05"), "2026-10-27", KINI)).toBeNull();
    expect(periksaWaktuTunda(witaKeMs("2026-10-27 17:40"), "2026-10-27", KINI)).toBeNull();
    expect(periksaWaktuTunda(witaKeMs("2026-10-27 23:59"), "2026-10-27", KINI)).toBeNull();
    expect(periksaWaktuTunda(witaKeMs("2026-10-28 00:00"), "2026-10-27", KINI)).toMatch(/hanya ditulis pada hari sidangnya/);
    expect(periksaWaktuTunda(witaKeMs("2026-10-28 08:00"), "2026-10-27", KINI)).toMatch(/hari lain/);
    expect(periksaWaktuTunda(witaKeMs("2026-10-27 09:00"), "2026-10-27", KINI)).toMatch(/sudah lewat/);
    expect(periksaWaktuTunda(Number.NaN, "2026-10-27", KINI)).toMatch(/belum sah/);
    // Toleransi satu menit untuk jam yang baru saja dipilih.
    expect(periksaWaktuTunda(KINI - 30_000, "2026-10-27", KINI)).toBeNull();
  });

  it("BAS: pada atau sesudah hari sidangnya, tidak lampau", () => {
    expect(periksaWaktuBas(witaKeMs("2026-10-27 10:05"), "2026-10-27", KINI)).toBeNull();
    expect(periksaWaktuBas(witaKeMs("2026-10-29 08:00"), "2026-10-27", KINI)).toBeNull();
    expect(periksaWaktuBas(witaKeMs("2026-10-28 08:00"), "2026-10-28", KINI)).toBeNull();
    expect(periksaWaktuBas(witaKeMs("2026-10-28 08:00"), "2026-10-29", KINI)).toMatch(/pada atau sesudah hari sidangnya/);
    expect(periksaWaktuBas(witaKeMs("2026-10-27 08:00"), "2026-10-26", KINI)).toMatch(/sudah lewat/);
  });

  it("kedaluwarsa: tunda begitu hari sidangnya lewat (WITA); BAS sesudah 3 hari dari jam rencananya", () => {
    expect(tundaKedaluwarsa("2026-10-27", witaKeMs("2026-10-27 23:59"))).toBe(false);
    expect(tundaKedaluwarsa("2026-10-27", witaKeMs("2026-10-28 00:00"))).toBe(true);
    const rencana = witaKeMs("2026-10-27 09:00");
    expect(basKedaluwarsa(rencana, rencana + 2 * 24 * 3600_000)).toBe(false);
    expect(basKedaluwarsa(rencana, rencana + 3 * 24 * 3600_000 + 1000)).toBe(true);
  });

  it("tunggu ulang naik menurut percobaan dan berhenti di batas", () => {
    expect([1, 2, 3, 4, 9].map(tungguUlang)).toEqual([60, 180, 420, 900, 900]);
  });
});

describe("muatan penundaan", () => {
  const dasar = { alasanTunda: "  Majelis   hakim berhalangan ", tanggalBerikut: "2026-11-03", jamBerikut: "9:00", agendaBerikut: "Pembacaan gugatan" };

  it("dibersihkan: spasi dirapatkan, jam dibakukan HH:mm, kode angka jadi bilangan, hanya boolean untuk keliling", () => {
    const h = bersihkanMuatanTunda({ ...dasar, dihadiriOleh: "2", ruanganIdBerikut: "3", sidangKelilingBerikut: true, jenisPengadilan: "", ruangId: 5 }, "2026-10-27");
    expect(h).toEqual({
      ok: true,
      muatan: {
        alasanTunda: "Majelis hakim berhalangan",
        tanggalBerikut: "2026-11-03",
        jamBerikut: "09:00",
        agendaBerikut: "Pembacaan gugatan",
        dihadiriOleh: 2,
        ruanganIdBerikut: 3,
        sidangKelilingBerikut: true,
        ruangId: 5,
      },
    });
    const teks = bersihkanMuatanTunda({ ...dasar, sidangKelilingBerikut: "ya" }, "2026-10-27");
    expect(teks.ok && "sidangKelilingBerikut" in teks.muatan).toBe(false);
  });

  it("ditolak dengan kalimat awam: alasan/agenda kosong, kata ALETA (juga direnggangkan), tanggal tidak maju, jam tidak sah", () => {
    expect(bersihkanMuatanTunda({ ...dasar, alasanTunda: " " }, "2026-10-27")).toEqual({ ok: false, sebab: "Alasan penundaan belum diisi." });
    expect(bersihkanMuatanTunda({ ...dasar, agendaBerikut: "" }, "2026-10-27")).toMatchObject({ ok: false, sebab: expect.stringMatching(/Agenda/) });
    expect(bersihkanMuatanTunda({ ...dasar, alasanTunda: "ditunda lewat ALETA" }, "2026-10-27")).toMatchObject({ ok: false, sebab: expect.stringMatching(/ALETA/) });
    expect(bersihkanMuatanTunda({ ...dasar, agendaBerikut: "A.L.E.T.A" }, "2026-10-27")).toMatchObject({ ok: false });
    expect(bersihkanMuatanTunda({ ...dasar, tanggalBerikut: "2026-10-27" }, "2026-10-27")).toMatchObject({ ok: false, sebab: expect.stringMatching(/sesudah tanggal sidang/) });
    expect(bersihkanMuatanTunda({ ...dasar, tanggalBerikut: "2026-02-31" }, "2026-10-27")).toMatchObject({ ok: false, sebab: expect.stringMatching(/belum sah/) });
    expect(bersihkanMuatanTunda({ ...dasar, jamBerikut: "25:00" }, "2026-10-27")).toMatchObject({ ok: false, sebab: expect.stringMatching(/Jam sidang/) });
    expect(bersihkanMuatanTunda({ ...dasar, alasanTunda: "x".repeat(BATAS_SIDANG.alasanMaks + 1) }, "2026-10-27")).toMatchObject({ ok: false, sebab: expect.stringMatching(/terlalu panjang/) });
  });

  it("muatan tersimpan rusak tidak melempar; ringkasan satu kalimat tanpa label teknis", () => {
    expect(bacaMuatanTersimpan("{rusak")).toMatchObject({ jedaMin: 120, jedaMaks: 420 });
    const muatan = bacaMuatanTersimpan(JSON.stringify({ jedaMin: 90, jedaMaks: 300, bas: { ganti: true } }));
    expect(muatan).toEqual({ jedaMin: 90, jedaMaks: 300, bas: { ganti: true } });
    expect(ringkasMuatan("bas", muatan, "bas-12.rtf")).toBe('BAS "bas-12.rtf" - menggantikan e-Doc BAS yang sudah ada');
    expect(ringkasMuatan("bas", { jedaMin: 1, jedaMaks: 2, bas: { ganti: false } })).toBe("BAS berkas BAS");
    const tunda = bersihkanMuatanTunda({ alasanTunda: "Hakim berhalangan", tanggalBerikut: "2026-11-03", jamBerikut: "09:00", agendaBerikut: "Jawaban" }, "2026-10-27");
    expect(tunda.ok && ringkasMuatan("tunda", { jedaMin: 1, jedaMaks: 2, tunda: tunda.muatan })).toBe("Tunda: Hakim berhalangan - sidang berikutnya 2026-11-03 pukul 09:00, agenda Jawaban");
  });
});

describe("susunan jam", () => {
  it("tunda: bisa dimulai di atas jam kerja, semuanya di hari yang sama, tidak lintas hari", () => {
    const h = susunWaktuSidang({ jenis: "tunda", jumlah: 3, mulai: "2026-10-27 16:45", jedaMin: 120, jedaMaks: 420, libur: () => false, acak: () => 0.5 });
    expect(h.ok).toBe(true);
    expect(h.butir).toHaveLength(3);
    for (const b of h.butir) expect(b.wita.slice(0, 10)).toBe("2026-10-27");
    expect(h.butir[0].wita >= "2026-10-27 16:45").toBe(true);
    for (let i = 1; i < 3; i += 1) expect(h.butir[i].ms - h.butir[i - 1].ms).toBeGreaterThanOrEqual(120_000);
    // Tidak muat sampai tengah malam: ditolak seluruhnya dengan kalimat, bukan dipindah ke besok.
    const penuh = susunWaktuSidang({ jenis: "tunda", jumlah: 60, mulai: "2026-10-27 22:00", jedaMin: 300, jedaMaks: 420, libur: () => false, acak: () => 0.5 });
    expect(penuh.ok).toBe(false);
    expect(penuh.sebab).toMatch(/muat di hari itu/);
  });

  it("BAS: di dalam jam kerja satker, melewati istirahat dan akhir hari ke hari kerja berikutnya", () => {
    const h = susunWaktuSidang({ jenis: "bas", jumlah: 8, mulai: "2026-10-27 15:30", jedaMin: 600, jedaMaks: 900, libur: () => false, acak: () => 0.5 });
    expect(h.ok).toBe(true);
    for (const b of h.butir) expect(dalamJendela(b.ms, {}, () => false)).toBe(true);
    const hari = new Set(h.butir.map((b) => b.wita.slice(0, 10)));
    expect(hari.size).toBeGreaterThan(1);
  });

  it("BAS: Sabtu/Minggu dan hari libur dilewati", () => {
    const h = susunWaktuSidang({ jenis: "bas", jumlah: 2, mulai: "2026-10-30 15:50", jedaMin: 900, jedaMaks: 900, libur: (iso) => iso === "2026-11-02", acak: () => 0.5 });
    expect(h.ok).toBe(true);
    for (const b of h.butir) expect(["2026-10-30", "2026-11-03"]).toContain(b.wita.slice(0, 10));
  });
});

// ─── 2. Migrasi ──────────────────────────────────────────────────────────────

describe("migrasi 0114 - berkas = DDL schema.ts, jurnal tanpa lubang, ikut cadangan", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0114_aleta_sidang_terjadwal.sql");

  it("jurnal: 0114 di idx 100 sekali (sesudah 0113), tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0114_"))).toEqual([expect.objectContaining({ idx: 100, tag: "0114_aleta_sidang_terjadwal" })]);
    expect(j.entries[99].tag).toBe("0113_aleta_ai_promo");
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i]?.when).toBeGreaterThan(j.entries[i - 1]?.when ?? 0);
    expect(existsSync(SQL)).toBe(true);
  });

  it("pernyataan berkas = DDL_SIDANG_TERJADWAL, berjalan di pg-mem, kedua tabel ikut cadangan", () => {
    expect(pernyataan(readFileSync(SQL, "utf8"))).toEqual([...DDL_SIDANG_TERJADWAL.tabel, ...DDL_SIDANG_TERJADWAL.indeks].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(readFileSync(SQL, "utf8"));
    expect(DDL_SIDANG_TERJADWAL.tabel).toHaveLength(2);
    for (const t of ["aleta_sidang_terjadwal", "aleta_sidang_terjadwal_jejak"]) {
      expect(kosong.public.many(`SELECT * FROM ${t}`)).toEqual([]);
      expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
    }
  });

  it("tanpa kunci asing dan tanpa CHECK; kolom sesuai kontrak", () => {
    const sql = readFileSync(SQL, "utf8").replace(/--.*$/gm, "");
    expect(/REFERENCES|FOREIGN KEY|CHECK\s*\(/i.test(sql)).toBe(false);
    for (const k of [
      "jenis", "dibuat_oleh", "dibuat_nama", "peran", "akun_sipp", "ip", "perkara_id", "nomor_perkara", "jadwal_id", "tanggal_sidang",
      "waktu_rencana", "waktu_rencana_wita", "muatan_json", "berkas_nama", "berkas_bentuk", "berkas_ukuran", "berkas_sha256", "berkas_jalur",
      "berkas_hapus_pada", "status", "percobaan", "klaim_oleh", "klaim_sampai", "tunggu_sampai", "hasil_ringkas", "hasil_json", "mulai_pada",
      "selesai_pada", "dibuat_pada", "diubah_pada", "butir_id", "peristiwa", "pelaku", "pelaku_id", "hasil", "ringkas", "rinci_json",
    ]) {
      expect(sql, k).toMatch(new RegExp(`\\b${k} `));
    }
  });

  it("folder berkas BAS terpisah dari putusan terjadwal, di mount yang sama; pemanggil lama tidak berubah", () => {
    expect(akarPenyimpanan({ ALETA_UPLOAD_DIR: "/data/uploads" })).toMatch(/putusan-terjadwal$/);
    expect(akarPenyimpanan({ ALETA_UPLOAD_DIR: "/data/uploads" }, "sidang-terjadwal")).toMatch(/uploads[\\/]sidang-terjadwal$/);
    expect(akarPenyimpanan({}, "sidang-terjadwal")).toMatch(/uploads[\\/]sidang-terjadwal$/);
  });
});

// ─── 3. Dunia tiruan: SIPP, bot, hak, akun ───────────────────────────────────

const HARI = "2026-10-27"; // Selasa
const AKTOR: Record<string, { id: string; name: string; roleId: string }> = {
  "usr-sd-pp": { id: "usr-sd-pp", name: "Siti Aminah", roleId: "pp" },
  "usr-sd-pp2": { id: "usr-sd-pp2", name: "Budi Santoso", roleId: "pp" },
  "usr-sd-admin": { id: "usr-sd-admin", name: "Admin Uji", roleId: "admin" },
};
const PP = "usr-sd-pp";
const PP2 = "usr-sd-pp2";
const ADMIN = "usr-sd-admin";

type SidangSipp = { perkaraId: string; nomor: string; tanggal: string; ditunda: boolean; alasan: string; putusan: string };
type BasSipp = { perkaraId: string; tanggal: string; adaBas: boolean; jalur: string; panitera: string[] | null };

const gagalBot = (sebab: string, kode = "", sementara = false): HasilBot<never> => ({ ok: false, sebab, kode, sementara });

function buatDunia(akar: string) {
  const JAM = { sekarang: wita("2026-10-27 08:00") };
  const tunda = new Map<string, SidangSipp>();
  const bas = new Map<string, BasSipp>();
  const rekam = { tulis: [] as Array<Record<string, unknown>>, kering: [] as Array<Record<string, unknown>>, unggah: [] as MuatanUnggahBas[] };
  const hakDitolak = new Set<string>();
  const akun: Record<string, { ok: true; username: string; milik: string[] } | { ok: false; pesan: string; kode?: string; milik: string[] }> = {
    [PP]: { ok: true, username: "pp.satu", milik: ["pp.satu"] },
    [PP2]: { ok: true, username: "pp.dua", milik: ["pp.dua"] },
    [ADMIN]: { ok: false, pesan: "Akun ALETA Anda belum tertaut ke akun SIPP.", kode: "akun_sipp_belum_tertaut", milik: [] },
  };
  const sementara = { keadaan: false, kering: false, tulis: false, cek: false, unggah: false };
  const jawab: { kering?: HasilBot<Record<string, unknown>>; tulis?: HasilBot<Record<string, unknown>>; unggah?: HasilBot<Record<string, unknown>> } = {};

  const deps: DepsSidang = {
    sekarang: () => JAM.sekarang,
    acak: () => 0.5,
    muatLibur: TIDAK_LIBUR,
    hak: async (_db, jenis, userId) => {
      if (hakDitolak.has(`${jenis}:${userId}`)) throw new ApiError(403, "Peran Anda tidak diberi akses panel. Hubungi administrator ALETA.");
      const aktor = AKTOR[userId];
      if (!aktor) throw new ApiError(401, "User aktif tidak valid atau sudah nonaktif.");
      return { aktor, peran: userId === ADMIN ? "admin" : "pp", pengawas: userId === ADMIN };
    },
    aktorPanel: async (_db, userId) => {
      const aktor = AKTOR[userId];
      if (!aktor) throw new ApiError(401, "User aktif tidak valid atau sudah nonaktif.");
      return { aktor, pengawas: userId === ADMIN };
    },
    akunSipp: async (_db, userId) => akun[userId] ?? { ok: false, pesan: "Akun SIPP belum tertaut.", milik: [] },
    tolakLibur: async () => null,
    cekBas: async (perkaraId, sidangId): Promise<HasilBot<CekBas>> => {
      if (sementara.cek) return gagalBot("bot mati", "", true);
      const s = bas.get(sidangId);
      if (!s || s.perkaraId !== perkaraId) return gagalBot("tidak ada", "sidang_tidak_ditemukan");
      return { ok: true, data: { adaBas: s.adaBas, jalur: s.jalur, tanggalSidang: s.tanggal, urutan: 2, panitera: s.panitera } };
    },
    keadaanSidang: async (jadwalId): Promise<HasilBot<KeadaanSidang>> => {
      if (sementara.keadaan) return gagalBot("bot mati", "", true);
      const s = tunda.get(jadwalId);
      if (!s) return gagalBot("Sidang ini tidak ditemukan di SIPP.", "jadwal_tidak_ketemu");
      return { ok: true, data: { perkaraId: s.perkaraId, nomorPerkara: s.nomor, tanggalSidang: s.tanggal, ditunda: s.ditunda, alasanDitunda: s.alasan, tanggalPutusan: s.putusan } };
    },
    tulisTunda: async (badan) => {
      if (badan.kering === true) {
        rekam.kering.push(badan);
        if (sementara.kering) return gagalBot("bot mati", "", true);
        return jawab.kering ?? { ok: true, data: { ok: true, kering: true } };
      }
      rekam.tulis.push(badan);
      if (sementara.tulis) return gagalBot("aleta_bot tidak merespons dalam 60000ms.", "", true);
      if (jawab.tulis) return jawab.tulis;
      const s = tunda.get(String(badan.jadwalId));
      if (s) s.ditunda = true;
      return { ok: true, data: { ok: true, sidangBerikutnya: { tanggal: badan.tanggalBerikut, jam: badan.jamBerikut }, atasNama: { username: "pp.perkara" } } };
    },
    unggahBas: async (m) => {
      rekam.unggah.push(m);
      if (sementara.unggah) return gagalBot("aleta_bot tidak dapat dihubungi", "", true);
      if (jawab.unggah) return jawab.unggah;
      const s = bas.get(m.sidangId);
      if (s) {
        s.adaBas = true;
        s.jalur = "bas-baru.rtf";
      }
      return { ok: true, data: { ok: true, jalur: "resources/file/doc/2026/10/bas-baru.rtf", nama: "bas-baru.rtf", urutan: 2, bentuk: "rtf", diganti: m.ganti } };
    },
    simpanBerkas: (id, bentuk, bita, kini) => simpanBerkas(id, bentuk, bita, { akar, kini }),
    bacaBerkas: (jalur) => bacaBerkas(jalur, akar),
    hapusBerkas: (jalur) => hapusBerkas(jalur, akar),
  };
  return {
    deps,
    JAM,
    rekam,
    hakDitolak,
    akun,
    sementara,
    jawab,
    tunda,
    bas,
    /** Daftarkan sidang tunda di SIPP tiruan dan kembalikan butir masukannya. */
    sidangTunda(n: number, o: Partial<SidangSipp> = {}, masukan: Record<string, unknown> = {}) {
      const nomor = `${n}/Pdt.G/2026/PA.Dgl`;
      tunda.set(String(9000 + n), { perkaraId: String(100 + n), nomor, tanggal: HARI, ditunda: false, alasan: "", putusan: "", ...o });
      return {
        jadwalId: String(9000 + n),
        perkaraId: String(100 + n),
        nomorPerkara: nomor,
        tanggalSidang: HARI,
        alasanTunda: "Majelis hakim berhalangan hadir",
        tanggalBerikut: "2026-11-03",
        jamBerikut: "09:00",
        agendaBerikut: "Pembacaan gugatan",
        ...masukan,
      };
    },
    /** Daftarkan sidang BAS di SIPP tiruan; pulang butir masukan + berkasnya. */
    sidangBas(n: number, o: Partial<BasSipp> = {}, masukan: Record<string, unknown> = {}, isi?: Uint8Array) {
      const nomor = `${n}/Pdt.G/2026/PA.Dgl`;
      bas.set(String(7000 + n), { perkaraId: String(100 + n), tanggal: "2026-10-26", adaBas: false, jalur: "", panitera: ["Siti Aminah"], ...o });
      const berkas: Record<string, BerkasMasuk> = { [`b${n}`]: { nama: `bas-${n}.rtf`, bita: isi ?? basRtf(nomor) } };
      return {
        butir: { perkaraId: String(100 + n), sidangId: String(7000 + n), nomorPerkara: nomor, tanggalSidang: "2026-10-26", berkas: `b${n}`, ...masukan },
        berkas,
      };
    },
  };
}
type Dunia = ReturnType<typeof buatDunia>;

const basRtf = (nomor: string) =>
  rtf(["BERITA ACARA SIDANG", `Nomor ${nomor}`, "Sidang Pertama", "Pengadilan Agama Donggala yang memeriksa dan mengadili perkara Cerai Gugat pada tingkat pertama;", "Penggugat hadir sendiri;"]);

// ─── 4. Layanan dan pelaksana (pg-mem) ───────────────────────────────────────

describe("layanan dan pelaksana atas basis data", () => {
  let db: AletaDatabase;
  let dunia: Dunia;
  const akar = mkdtempSync(path.join(process.env.TMP || process.env.TEMP || ".", "sdt-"));
  const baris = async (sql: string, p: unknown[] = []) => db.queryAll<Record<string, unknown>>(sql, p as never[]);
  const berkasDiCakram = () => (existsSync(akar) ? readdirSync(akar, { recursive: true }).filter((x) => /\.(rtf|docx|doc|pdf)$/.test(String(x))) : []);

  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true });
    // Pengguna sungguhan untuk audit_logs.actor_user_id (berkunci asing ke users).
    const peran = await db.queryOne<{ id: string }>("SELECT id FROM roles LIMIT 1");
    const jabatan = await db.queryOne<{ id: string }>("SELECT id FROM positions LIMIT 1");
    const sekarang = new Date().toISOString();
    for (const p of Object.values(AKTOR)) {
      await db.run(
        "INSERT INTO users (id, username, password_hash, name, email, whatsapp_number, role_id, position_id, created_at, updated_at) VALUES (?, ?, 'x', ?, ?, '0', ?, ?, ?, ?)",
        [p.id, p.id, p.name, p.id + "@uji.lokal", peran?.id ?? "", jabatan?.id ?? "", sekarang, sekarang]
      );
    }
  }, 180000);
  afterAll(async () => {
    await db?.close();
    rmSync(akar, { recursive: true, force: true });
  });
  beforeEach(async () => {
    await db.run("DELETE FROM aleta_sidang_terjadwal");
    await db.run("DELETE FROM aleta_sidang_terjadwal_jejak");
    rmSync(akar, { recursive: true, force: true });
    dunia = buatDunia(akar);
  });

  const buat = (jenis: "tunda" | "bas", mulai: string, butir: unknown[], opsi: Record<string, unknown> = {}, berkas?: Record<string, BerkasMasuk>, userId = PP) =>
    buatTerjadwal(db, userId, "192.168.9.97", { jenis, mulai, butir, berkas, ...opsi }, dunia.deps);

  // ── Tunda: menjadwalkan ────────────────────────────────────────────────────

  describe("tunda - menjadwalkan", () => {
    it("menjadwalkan: baris + jejak + audit; atas PP penjadwal; SATU kali kering lewat bot per butir; tidak menulis ke SIPP", async () => {
      const b1 = dunia.sidangTunda(1);
      const b2 = dunia.sidangTunda(2, {}, { dihadiriOleh: "2", sidangKelilingBerikut: false });
      const h = await buat("tunda", "2026-10-27 09:00", [b1, b2]);
      expect(h.ok).toBe(true);
      if (!h.ok) return;
      expect(h.butir).toHaveLength(2);
      expect(h.butir[0].waktuWita >= "2026-10-27 09:00" && h.butir[0].waktuWita < "2026-10-27 09:01").toBe(true);
      expect(h.perkiraanSelesai).toBe(h.butir[1].waktuWita);
      expect(h.butir[1].waktuWita >= "2026-10-27 09:02").toBe(true);

      // Kering saja: tidak satu pun tulisan.
      expect(dunia.rekam.tulis).toHaveLength(0);
      expect(dunia.rekam.kering).toHaveLength(2);
      expect(dunia.rekam.kering[0]).toMatchObject({
        kering: true,
        jadwalId: "9001",
        perkaraId: "101",
        tanggalBerikut: "2026-11-03",
        operator: PP,
        operatorNama: "Siti Aminah",
        operatorAkunSipp: "pp.satu",
        ip: "192.168.9.97",
      });
      expect(dunia.rekam.kering[0]).not.toHaveProperty("jamKerja");
      expect(dunia.rekam.kering[1]).toMatchObject({ dihadiriOleh: 2, sidangKelilingBerikut: false });

      const rows = await baris("SELECT * FROM aleta_sidang_terjadwal ORDER BY waktu_rencana");
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        jenis: "tunda",
        dibuat_oleh: PP,
        dibuat_nama: "Siti Aminah",
        peran: "pp",
        akun_sipp: "pp.satu",
        ip: "192.168.9.97",
        perkara_id: "101",
        jadwal_id: "9001",
        tanggal_sidang: HARI,
        status: "menunggu",
        percobaan: 0,
        berkas_jalur: "",
      });
      expect(JSON.parse(String(rows[0].muatan_json))).toMatchObject({ jedaMin: 120, jedaMaks: 420, tunda: { alasanTunda: "Majelis hakim berhalangan hadir", jamBerikut: "09:00" } });
      const jejak = await baris("SELECT * FROM aleta_sidang_terjadwal_jejak ORDER BY waktu");
      expect(jejak.map((j) => j.peristiwa)).toEqual(["dijadwalkan", "dijadwalkan"]);
      expect(jejak[0]).toMatchObject({ pelaku: "pengguna: Siti Aminah", akun_sipp: "pp.satu", jenis: "tunda", hasil: "ok" });
      expect(JSON.parse(String(jejak[0].rinci_json))).toMatchObject({ ip: "192.168.9.97", tanggalSidang: HARI });
      const audit = await baris("SELECT actor_user_id FROM audit_logs WHERE action = 'SIDANG_TERJADWAL_DIBUAT' AND entity_id = ?", [h.butir[0].id]);
      expect(audit).toHaveLength(1);
      expect(audit[0].actor_user_id).toBe(PP);
    });

    it("satu butir tidak sah menolak SELURUHNYA, tidak ada baris; semua yang bermasalah disebut dengan nomor perkaranya", async () => {
      const baik = dunia.sidangTunda(1);
      const alesan = dunia.sidangTunda(2, {}, { alasanTunda: "ditunda oleh ALETA" });
      const sudah = dunia.sidangTunda(3, { ditunda: true });
      const h = await buat("tunda", "2026-10-27 09:00", [baik, alesan, sudah]);
      expect(h.ok).toBe(false);
      if (h.ok) return;
      expect(h.tolak.map((t) => t.nomorPerkara)).toEqual(["2/Pdt.G/2026/PA.Dgl", "3/Pdt.G/2026/PA.Dgl"]);
      expect(h.tolak[0].sebab).toMatch(/ALETA/);
      expect(h.tolak[1].sebab).toMatch(/sudah ditunda/);
      expect(h.sebab).toMatch(/2 dari 3 sidang tidak sah; tidak ada yang dijadwalkan/);
      expect(await baris("SELECT id FROM aleta_sidang_terjadwal")).toHaveLength(0);
    });

    it("keadaan SIPP yang menghalangi ditolak: sudah diputus, hasil sudah dicatat, tanggal berubah, perkara tidak cocok, sidang tidak ada", async () => {
      const diputus = dunia.sidangTunda(1, { putusan: "2026-10-27" });
      const hasil = dunia.sidangTunda(2, { alasan: "Hadir semua pihak" });
      const ubah = dunia.sidangTunda(3, { tanggal: "2026-10-28" });
      const lain = dunia.sidangTunda(4, {}, { perkaraId: "999" });
      const hilang = { ...dunia.sidangTunda(5), jadwalId: "00001" };
      const h = await buat("tunda", "2026-10-27 09:00", [diputus, hasil, ubah, lain, hilang]);
      expect(h.ok).toBe(false);
      if (h.ok) return;
      expect(h.tolak.map((t) => t.sebab)).toEqual([
        expect.stringMatching(/sudah diputus/),
        expect.stringMatching(/Hasil sidang ini sudah dicatat/),
        expect.stringMatching(/Tanggal sidang di SIPP 2026-10-28/),
        expect.stringMatching(/bukan milik perkara tersebut/),
        expect.stringMatching(/tidak ditemukan/),
      ]);
    });

    it("penolakan bot pada percobaan kering dikembalikan sebagai kalimat sebabnya; tidak ada baris", async () => {
      dunia.jawab.kering = gagalBot("Tanggal sidang berikutnya jatuh pada hari libur (Hari Raya).", "tanggal_berikut_hari_libur");
      const h = await buat("tunda", "2026-10-27 09:00", [dunia.sidangTunda(1)]);
      expect(h.ok).toBe(false);
      if (h.ok) return;
      expect(h.tolak).toEqual([{ nomorPerkara: "1/Pdt.G/2026/PA.Dgl", sebab: "Tanggal sidang berikutnya jatuh pada hari libur (Hari Raya)." }]);
      expect(h.sebab).toBe("1/Pdt.G/2026/PA.Dgl: Tanggal sidang berikutnya jatuh pada hari libur (Hari Raya).");
      expect(await baris("SELECT id FROM aleta_sidang_terjadwal")).toHaveLength(0);
    });

    it("bot tidak terjangkau saat memeriksa (keadaan atau kering): tidak ada yang dijadwalkan dan petugas diminta mencoba lagi", async () => {
      dunia.sementara.keadaan = true;
      const a = await buat("tunda", "2026-10-27 09:00", [dunia.sidangTunda(1)]);
      expect(a.ok).toBe(false);
      if (!a.ok) expect(a.sebab).toMatch(/belum dapat dibaca.*coba lagi/i);
      dunia.sementara.keadaan = false;
      dunia.sementara.kering = true;
      const b = await buat("tunda", "2026-10-27 09:00", [dunia.sidangTunda(2)]);
      expect(b.ok).toBe(false);
      if (!b.ok) expect(b.sebab).toMatch(/belum dapat diperiksa ke SIPP/);
      expect(await baris("SELECT id FROM aleta_sidang_terjadwal")).toHaveLength(0);
    });

    it("waktu rencana yang jatuh di hari lain atau sudah lewat ditolak (hari sama); sidang hari ini tidak dapat dijadwalkan besok", async () => {
      // Mulai besok pagi untuk sidang hari ini: jatuh di hari lain.
      const a = await buat("tunda", "2026-10-28 08:00", [dunia.sidangTunda(1)]);
      expect(a.ok).toBe(false);
      if (!a.ok) expect(a.tolak[0].sebab).toMatch(/hanya ditulis pada hari sidangnya \(2026-10-27\)/);
      // Jam mulai lampau.
      const b = await buat("tunda", "2026-10-27 07:00", [dunia.sidangTunda(2)]);
      expect(b.ok).toBe(false);
      if (!b.ok) expect(b.sebab).toMatch(/Jam mulai sudah lewat/);
      // Tidak muat dalam sisa hari.
      const banyak = Array.from({ length: 40 }, (_, i) => dunia.sidangTunda(10 + i));
      const c = await buat("tunda", "2026-10-27 22:30", banyak, { jedaMin: 300, jedaMaks: 420 });
      expect(c.ok).toBe(false);
      if (!c.ok) expect(c.sebab).toMatch(/muat di hari itu/);
      expect(await baris("SELECT id FROM aleta_sidang_terjadwal")).toHaveLength(0);
    });

    it("boleh dimulai di atas jam kerja (setelah 16.30) pada hari sidang", async () => {
      dunia.JAM.sekarang = wita("2026-10-27 16:40");
      const h = await buat("tunda", "2026-10-27 16:45", [dunia.sidangTunda(1)]);
      expect(h.ok).toBe(true);
    });

    it("hak: tanpa hak tunda 403 dan tidak ada yang dibaca atau ditulis; pemanggil tak dikenal 401", async () => {
      dunia.hakDitolak.add(`tunda:${PP}`);
      await expect(buat("tunda", "2026-10-27 09:00", [dunia.sidangTunda(1)])).rejects.toMatchObject({ status: 403 });
      expect(dunia.rekam.kering).toHaveLength(0);
      await expect(buat("tunda", "2026-10-27 09:00", [dunia.sidangTunda(2)], {}, undefined, "usr-tak-ada")).rejects.toMatchObject({ status: 401 });
    });

    it("sidang yang sama tidak dijadwalkan dua kali (satu permintaan, atau sudah menunggu); jenis lain tetap boleh", async () => {
      const b = dunia.sidangTunda(1);
      const ganda = await buat("tunda", "2026-10-27 09:00", [b, { ...b }]);
      expect(ganda.ok).toBe(false);
      if (!ganda.ok) expect(ganda.tolak[0].sebab).toMatch(/terpilih dua kali/);
      expect((await buat("tunda", "2026-10-27 09:00", [b])).ok).toBe(true);
      const lagi = await buat("tunda", "2026-10-27 10:00", [b]);
      expect(lagi.ok).toBe(false);
      if (!lagi.ok) expect(lagi.tolak[0].sebab).toMatch(/sudah dijadwalkan/);
    });

    it("masukan rusak: jenis tak dikenal, daftar kosong, jam mulai tak sah, nomor sidang tak terbaca", async () => {
      expect(await buatTerjadwal(db, PP, "", { jenis: "putus", mulai: "2026-10-27 09:00", butir: [] }, dunia.deps)).toMatchObject({ ok: false, sebab: expect.stringMatching(/Jenis pekerjaan/) });
      expect(await buat("tunda", "2026-10-27 09:00", [])).toMatchObject({ ok: false, sebab: expect.stringMatching(/Belum ada sidang/) });
      expect(await buat("tunda", "kemarin", [dunia.sidangTunda(1)])).toMatchObject({ ok: false, sebab: expect.stringMatching(/belum sah/) });
      const h = await buat("tunda", "2026-10-27 09:00", [{ ...dunia.sidangTunda(2), jadwalId: "abc" }]);
      expect(h.ok).toBe(false);
      if (!h.ok) expect(h.tolak[0].sebab).toMatch(/belum terbaca/);
    });
  });

  // ── BAS: menjadwalkan ──────────────────────────────────────────────────────

  describe("BAS - menjadwalkan", () => {
    it("menjadwalkan: berkas disimpan di folder sendiri tanpa grup tersembunyi, jam di jendela kerja dan >= hari sidang, atas akun SIPP penjadwal", async () => {
      const kotor = new TextEncoder().encode("{\\rtf1\\ansi {\\*\\isianasal sandi-rahasia}BERITA ACARA SIDANG\\par Nomor 1/Pdt.G/2026/PA.Dgl\\par Sidang Pertama}");
      const s1 = dunia.sidangBas(1, {}, {}, kotor);
      const s2 = dunia.sidangBas(2);
      const h = await buat("bas", "2026-10-27 09:00", [s1.butir, s2.butir], {}, { ...s1.berkas, ...s2.berkas });
      expect(h.ok).toBe(true);
      if (!h.ok) return;
      const rows = await baris("SELECT * FROM aleta_sidang_terjadwal ORDER BY waktu_rencana");
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ jenis: "bas", akun_sipp: "pp.satu", dibuat_oleh: PP, jadwal_id: "7001", perkara_id: "101", tanggal_sidang: "2026-10-26", berkas_nama: "bas-1.rtf", berkas_bentuk: "rtf", status: "menunggu" });
      for (const r of rows) {
        expect(dalamJendela(witaKeMs(String(r.waktu_rencana_wita)), {}, () => false)).toBe(true);
        expect(String(r.waktu_rencana_wita).slice(0, 10) >= String(r.tanggal_sidang)).toBe(true);
        expect(String(r.berkas_jalur)).toMatch(/^\d{6}\/sdt-[0-9a-f-]+\.rtf$/);
        expect(String(r.berkas_sha256)).toMatch(/^[0-9a-f]{64}$/);
      }
      // Berkas tersimpan sudah bersih dari grup tersembunyi dan ada di folder sendiri.
      const simpan = new TextDecoder().decode((await bacaBerkas(String(rows[0].berkas_jalur), akar)) ?? new Uint8Array());
      expect(simpan).toContain("BERITA ACARA");
      expect(simpan).not.toMatch(/isianasal|sandi-rahasia/);
      expect(Number(rows[0].berkas_ukuran)).toBe(simpan.length);
      expect(berkasDiCakram()).toHaveLength(2);
      expect(JSON.parse(String(rows[0].muatan_json))).toMatchObject({ bas: { ganti: false } });
      // Tidak ada tulisan ke SIPP saat menjadwalkan.
      expect(dunia.rekam.unggah).toHaveLength(0);
      const jejak = await baris("SELECT * FROM aleta_sidang_terjadwal_jejak");
      expect(jejak.map((j) => j.peristiwa)).toEqual(["dijadwalkan", "dijadwalkan"]);
    });

    it("peringatan isi berkas non-RTF ikut dikembalikan, tidak menolak", async () => {
      const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj");
      const s = dunia.sidangBas(1, {}, {}, pdf);
      const h = await buat("bas", "2026-10-27 09:00", [s.butir], {}, s.berkas);
      expect(h.ok).toBe(true);
      if (h.ok) expect(h.peringatan.join(" ")).toMatch(/PDF tidak dapat dibaca isinya/);
    });

    it("ditolak SEMUA bila satu tidak sah, dan tidak ada berkas tertinggal di cakram: bukan BAS, nomor perkara lain, berkas tak dipilih, bukan RTF/DOCX/DOC/PDF", async () => {
      const baik = dunia.sidangBas(1);
      const bukanBas = dunia.sidangBas(2, {}, {}, rtf(["PUTUSAN", "Nomor 2/Pdt.G/2026/PA.Dgl", "MENGADILI:", "1. Mengabulkan gugatan;"]));
      const nomorLain = dunia.sidangBas(3, {}, {}, basRtf("99/Pdt.G/2026/PA.Dgl"));
      const tanpa = dunia.sidangBas(4);
      delete tanpa.berkas.b4;
      const teksBiasa = dunia.sidangBas(5, {}, {}, new TextEncoder().encode("hanya teks"));
      const h = await buat("bas", "2026-10-27 09:00", [baik.butir, bukanBas.butir, nomorLain.butir, tanpa.butir, teksBiasa.butir], {}, { ...baik.berkas, ...bukanBas.berkas, ...nomorLain.berkas, ...tanpa.berkas, ...teksBiasa.berkas });
      expect(h.ok).toBe(false);
      if (h.ok) return;
      expect(h.tolak.map((t) => t.nomorPerkara)).toEqual(["2/Pdt.G/2026/PA.Dgl", "3/Pdt.G/2026/PA.Dgl", "4/Pdt.G/2026/PA.Dgl", "5/Pdt.G/2026/PA.Dgl"]);
      expect(h.tolak[0].sebab).toMatch(/bukan berita acara/);
      expect(h.tolak[1].sebab).toMatch(/menyebut nomor 99\/Pdt\.G\/2026\/PA\.Dgl/);
      expect(h.tolak[2].sebab).toMatch(/Berkas BAS belum dipilih/);
      expect(h.tolak[3].sebab).toMatch(/bukan RTF, PDF, DOC, maupun DOCX/);
      expect(await baris("SELECT id FROM aleta_sidang_terjadwal")).toHaveLength(0);
      expect(berkasDiCakram()).toHaveLength(0);
    });

    it("e-Doc BAS yang sudah ada tidak diganti kecuali 'ganti' dicentang tegas; yang dicentang dicatat di muatan", async () => {
      const ada = dunia.sidangBas(1, { adaBas: true, jalur: "bas-lama.rtf" });
      const a = await buat("bas", "2026-10-27 09:00", [ada.butir], {}, ada.berkas);
      expect(a.ok).toBe(false);
      if (!a.ok) expect(a.tolak[0].sebab).toMatch(/sudah ada di SIPP \(bas-lama\.rtf\).*"Ganti"/);
      const b = await buat("bas", "2026-10-27 09:00", [{ ...ada.butir, ganti: true }], {}, ada.berkas);
      expect(b.ok).toBe(true);
      const [r] = await baris("SELECT muatan_json FROM aleta_sidang_terjadwal");
      expect(JSON.parse(String(r.muatan_json)).bas.ganti).toBe(true);
    });

    it("PP hanya BAS perkaranya sendiri; yang mengawasi (admin) boleh semua; tanpa akun SIPP tertaut ditolak", async () => {
      const lain = dunia.sidangBas(1, { panitera: ["Budi Santoso"] });
      const a = await buat("bas", "2026-10-27 09:00", [lain.butir], {}, lain.berkas, PP);
      expect(a.ok).toBe(false);
      if (!a.ok) expect(a.tolak[0].sebab).toMatch(/bukan perkara Anda sebagai Panitera Pengganti/);
      // Petugas tidak terbaca: ditolak (bukan diloloskan).
      const gelap = dunia.sidangBas(2, { panitera: null });
      const g = await buat("bas", "2026-10-27 09:00", [gelap.butir], {}, gelap.berkas, PP);
      expect(g.ok).toBe(false);
      // Admin tanpa akun SIPP tertaut: ditolak dengan sebab akun, tidak ada yang tertulis.
      const b = await buat("bas", "2026-10-27 09:00", [lain.butir], {}, lain.berkas, ADMIN);
      expect(b.ok).toBe(false);
      if (!b.ok) expect(b.sebab).toMatch(/belum tertaut ke akun SIPP/);
      dunia.akun[ADMIN] = { ok: true, username: "admin.sipp", milik: ["admin.sipp"] };
      const c = await buat("bas", "2026-10-27 09:00", [lain.butir], {}, lain.berkas, ADMIN);
      expect(c.ok).toBe(true);
      const [r] = await baris("SELECT akun_sipp, peran FROM aleta_sidang_terjadwal");
      expect(r).toMatchObject({ akun_sipp: "admin.sipp", peran: "admin" });
    });

    it("tanpa hak BAS 403; tanggal sidang beda dengan SIPP ditolak; sidang tak ada di SIPP ditolak; bot mati = tidak ada yang dijadwalkan", async () => {
      const s = dunia.sidangBas(1);
      dunia.hakDitolak.add(`bas:${PP}`);
      await expect(buat("bas", "2026-10-27 09:00", [s.butir], {}, s.berkas)).rejects.toMatchObject({ status: 403 });
      dunia.hakDitolak.clear();
      const beda = await buat("bas", "2026-10-27 09:00", [{ ...s.butir, tanggalSidang: "2026-10-25" }], {}, s.berkas);
      expect(beda.ok).toBe(false);
      if (!beda.ok) expect(beda.tolak[0].sebab).toMatch(/Tanggal sidang di SIPP 2026-10-26, bukan 2026-10-25/);
      const hilang = await buat("bas", "2026-10-27 09:00", [{ ...s.butir, sidangId: "1" }], {}, s.berkas);
      expect(hilang.ok).toBe(false);
      dunia.sementara.cek = true;
      const mati = await buat("bas", "2026-10-27 09:00", [s.butir], {}, s.berkas);
      expect(mati.ok).toBe(false);
      if (!mati.ok) expect(mati.sebab).toMatch(/belum dapat dibaca/);
      expect(await baris("SELECT id FROM aleta_sidang_terjadwal")).toHaveLength(0);
      expect(berkasDiCakram()).toHaveLength(0);
    });

    it("berkas terlalu besar atau jumlah berkas melampaui batas ditolak sebelum disimpan", async () => {
      const besar = new Uint8Array(BATAS_SIDANG.ukuranBerkas + 1);
      besar.set(new TextEncoder().encode("{\\rtf1 BERITA ACARA"), 0);
      const s = dunia.sidangBas(1, {}, {}, besar);
      const h = await buat("bas", "2026-10-27 09:00", [s.butir], {}, s.berkas);
      expect(h.ok).toBe(false);
      if (!h.ok) expect(h.tolak[0].sebab).toMatch(/melampaui 10 MB/);
    });
  });

  // ── Daftar dan kelola ──────────────────────────────────────────────────────

  describe("daftar dan kelola", () => {
    it("daftar: milik sendiri; semua=1 hanya untuk Super Admin/Admin; filter jenis, aktif, jadwalId; bentuk sesuai kontrak", async () => {
      const t = dunia.sidangTunda(1);
      await buat("tunda", "2026-10-27 09:00", [t]);
      const s = dunia.sidangBas(2);
      await buat("bas", "2026-10-27 09:30", [s.butir], {}, s.berkas, PP);
      const lain = dunia.sidangBas(3, { panitera: ["Budi Santoso"] });
      dunia.akun[PP2] = { ok: true, username: "pp.dua", milik: ["pp.dua"] };
      await buat("bas", "2026-10-27 10:00", [lain.butir], {}, lain.berkas, PP2);

      const saya = await daftarTerjadwal(db, PP, {}, dunia.deps);
      expect(saya.butir).toHaveLength(2);
      const ia = saya.butir.find((x) => x.jenis === "tunda");
      expect(ia).toMatchObject({
        perkaraId: "101",
        nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
        jadwalId: "9001",
        tanggalSidang: HARI,
        status: "menunggu",
        namaStatus: "menunggu",
        hasilRingkas: "",
        berkasNama: "",
        dibuatNama: "Siti Aminah",
        bolehBatal: true,
      });
      expect(ia?.waktuWita).toMatch(/^2026-10-27 09:\d\d$/);
      expect(ia?.ringkasMuatan).toMatch(/^Tunda: Majelis hakim berhalangan hadir - sidang berikutnya 2026-11-03 pukul 09:00/);
      // PP tidak melihat milik orang lain walau meminta semua=1.
      expect((await daftarTerjadwal(db, PP, { semua: true }, dunia.deps)).butir).toHaveLength(2);
      expect((await daftarTerjadwal(db, ADMIN, { semua: true }, dunia.deps)).butir).toHaveLength(3);
      expect((await daftarTerjadwal(db, ADMIN, {}, dunia.deps)).butir).toHaveLength(0);
      expect((await daftarTerjadwal(db, PP, { jenis: "bas" }, dunia.deps)).butir.map((x) => x.jenis)).toEqual(["bas"]);
      expect((await daftarTerjadwal(db, PP, { jadwalId: "9001" }, dunia.deps)).butir).toHaveLength(1);
      expect((await daftarTerjadwal(db, PP, { aktif: true }, dunia.deps)).butir).toHaveLength(2);
    });

    it("ringkas: hitungan menunggu/jalan per jenis untuk lencana tombol; milik sendiri, semua hanya pengawas; tanpa ringkas tidak ada", async () => {
      const t = dunia.sidangTunda(1);
      await buat("tunda", "2026-10-27 09:00", [t]);
      const s = dunia.sidangBas(2);
      await buat("bas", "2026-10-27 09:30", [s.butir], {}, s.berkas, PP);
      const nol = { menunggu: 0, jalan: 0 };

      const r = await daftarTerjadwal(db, PP, { aktif: true, batas: 1, ringkas: true }, dunia.deps);
      expect(r.butir).toHaveLength(1);
      expect(r.ringkasan).toEqual({ bas: { menunggu: 1, jalan: 0 }, tunda: { menunggu: 1, jalan: 0 } });
      expect((await daftarTerjadwal(db, PP, {}, dunia.deps)).ringkasan).toBeUndefined();
      // Admin tanpa semua=1: hanya miliknya (kosong); dengan semua=1: seluruhnya.
      expect((await daftarTerjadwal(db, ADMIN, { ringkas: true }, dunia.deps)).ringkasan).toEqual({ bas: nol, tunda: nol });
      expect((await daftarTerjadwal(db, ADMIN, { ringkas: true, semua: true }, dunia.deps)).ringkasan).toEqual({ bas: { menunggu: 1, jalan: 0 }, tunda: { menunggu: 1, jalan: 0 } });
      // PP meminta semua=1 tetap hanya miliknya.
      expect((await daftarTerjadwal(db, PP2, { ringkas: true, semua: true }, dunia.deps)).ringkasan).toEqual({ bas: nol, tunda: nol });
      // Yang dibatalkan tidak lagi dihitung.
      const id = (await daftarTerjadwal(db, PP, { jenis: "tunda" }, dunia.deps)).butir[0].id;
      await kelolaTerjadwal(db, PP, { aksi: "batal", id }, dunia.deps);
      expect((await daftarTerjadwal(db, PP, { ringkas: true }, dunia.deps)).ringkasan).toEqual({ bas: { menunggu: 1, jalan: 0 }, tunda: nol });
    });

    it("batal: pembuat dan admin boleh, orang lain 403; yang sudah selesai atau sedang jalan tidak; berkas dijadwalkan dihapus", async () => {
      const s = dunia.sidangBas(1);
      const h = await buat("bas", "2026-10-27 09:00", [s.butir], {}, s.berkas);
      if (!h.ok) throw new Error(h.sebab);
      const id = h.butir[0].id;
      await expect(kelolaTerjadwal(db, PP2, { aksi: "batal", id }, dunia.deps)).rejects.toMatchObject({ status: 403 });
      const r = await kelolaTerjadwal(db, PP, { aksi: "batal", id }, dunia.deps);
      expect(r.butir).toMatchObject({ status: "dibatalkan", bolehBatal: false });
      expect(r.butir.hasilRingkas).toMatch(/Dibatalkan oleh Siti Aminah/);
      await expect(kelolaTerjadwal(db, PP, { aksi: "batal", id }, dunia.deps)).rejects.toMatchObject({ status: 409 });
      const [baris1] = await baris("SELECT berkas_hapus_pada FROM aleta_sidang_terjadwal WHERE id = ?", [id]);
      expect(String(baris1.berkas_hapus_pada)).not.toBe("");
      const jejak = await baris("SELECT peristiwa FROM aleta_sidang_terjadwal_jejak WHERE butir_id = ? ORDER BY waktu", [id]);
      expect(jejak.map((j) => j.peristiwa)).toContain("dibatalkan");
      // Admin membatalkan milik orang lain.
      const t = dunia.sidangTunda(5);
      const h2 = await buat("tunda", "2026-10-27 09:00", [t]);
      if (!h2.ok) throw new Error(h2.sebab);
      expect((await kelolaTerjadwal(db, ADMIN, { aksi: "batal", id: h2.butir[0].id }, dunia.deps)).butir.status).toBe("dibatalkan");
      await expect(kelolaTerjadwal(db, PP, { aksi: "tidak-ada", id }, dunia.deps)).rejects.toMatchObject({ status: 400 });
      await expect(kelolaTerjadwal(db, PP, { aksi: "batal", id: "tidak-ada" }, dunia.deps)).rejects.toMatchObject({ status: 404 });
    });

    it("jadwal-ulang: tunda harus tetap di hari sidang; BAS harus di jam kerja dan >= hari sidang; hak jenisnya dinilai ulang", async () => {
      const t = dunia.sidangTunda(1);
      const h = await buat("tunda", "2026-10-27 09:00", [t]);
      if (!h.ok) throw new Error(h.sebab);
      const id = h.butir[0].id;
      await expect(kelolaTerjadwal(db, PP, { aksi: "jadwal-ulang", id, wita: "2026-10-28 09:00" }, dunia.deps)).rejects.toThrow(/hari sidangnya/);
      await expect(kelolaTerjadwal(db, PP, { aksi: "jadwal-ulang", id, wita: "2026-10-27 07:00" }, dunia.deps)).rejects.toThrow(/sudah lewat/);
      await expect(kelolaTerjadwal(db, PP, { aksi: "jadwal-ulang", id, wita: "besok" }, dunia.deps)).rejects.toThrow(/belum sah/);
      const ok = await kelolaTerjadwal(db, PP, { aksi: "jadwal-ulang", id, wita: "2026-10-27 18:30" }, dunia.deps);
      expect(ok.butir.waktuWita).toBe("2026-10-27 18:30");
      dunia.hakDitolak.add(`tunda:${PP}`);
      await expect(kelolaTerjadwal(db, PP, { aksi: "jadwal-ulang", id, wita: "2026-10-27 19:00" }, dunia.deps)).rejects.toMatchObject({ status: 403 });
      // ...tetapi membatalkan tetap boleh walau haknya sudah dicabut.
      expect((await kelolaTerjadwal(db, PP, { aksi: "batal", id }, dunia.deps)).butir.status).toBe("dibatalkan");

      const s = dunia.sidangBas(2);
      const hb = await buat("bas", "2026-10-27 09:00", [s.butir], {}, s.berkas);
      if (!hb.ok) throw new Error(hb.sebab);
      await expect(kelolaTerjadwal(db, PP, { aksi: "jadwal-ulang", id: hb.butir[0].id, wita: "2026-10-27 12:30" }, dunia.deps)).rejects.toThrow(/di luar jam kerja/);
      await expect(kelolaTerjadwal(db, PP, { aksi: "jadwal-ulang", id: hb.butir[0].id, wita: "2026-10-28 08:10" }, dunia.deps)).resolves.toMatchObject({ ok: true });
    });

    it("ulang: hanya yang gagal/kedaluwarsa; tunda yang hari sidangnya lewat tidak dapat diulang; BAS tanpa berkas tidak dapat diulang", async () => {
      const t = dunia.sidangTunda(1);
      const h = await buat("tunda", "2026-10-27 09:00", [t]);
      if (!h.ok) throw new Error(h.sebab);
      const id = h.butir[0].id;
      await expect(kelolaTerjadwal(db, PP, { aksi: "ulang", id }, dunia.deps)).rejects.toThrow(/tidak perlu diulang/);
      await ubahButir(db, id, { status: "gagal", hasil_ringkas: "SIPP menolak" });
      dunia.JAM.sekarang = wita("2026-10-27 10:00");
      const r = await kelolaTerjadwal(db, PP, { aksi: "ulang", id }, dunia.deps);
      expect(r.butir).toMatchObject({ status: "menunggu", percobaan: 0 });
      expect(r.butir.waktuWita >= "2026-10-27 10:01").toBe(true);
      expect(r.butir.hasilRingkas).toMatch(/Diulang atas permintaan Siti Aminah/);

      await ubahButir(db, id, { status: "kedaluwarsa" });
      dunia.JAM.sekarang = wita("2026-10-28 08:00");
      await expect(kelolaTerjadwal(db, PP, { aksi: "ulang", id }, dunia.deps)).rejects.toThrow(/penundaan tidak ditulis di hari lain/);
      const daftar = await daftarTerjadwal(db, PP, {}, dunia.deps);
      expect(daftar.butir[0]).toMatchObject({ status: "kedaluwarsa", bolehUlang: false });

      dunia.JAM.sekarang = wita("2026-10-27 08:00");
      const s = dunia.sidangBas(2);
      const hb = await buat("bas", "2026-10-27 09:00", [s.butir], {}, s.berkas);
      if (!hb.ok) throw new Error(hb.sebab);
      await ubahButir(db, hb.butir[0].id, { status: "gagal", berkas_jalur: "" });
      await expect(kelolaTerjadwal(db, PP, { aksi: "ulang", id: hb.butir[0].id }, dunia.deps)).rejects.toThrow(/Berkas .* sudah dihapus/);
    });
  });

  // ── Pelaksana: tunda ───────────────────────────────────────────────────────

  describe("pelaksana - tunda", () => {
    /** Menjadwalkan satu tunda pukul 09:00 lalu memajukan jam ke sesudahnya. */
    const siapTunda = async (n = 1, masukan: Record<string, unknown> = {}, sipp: Partial<SidangSipp> = {}) => {
      const h = await buat("tunda", "2026-10-27 09:00", [dunia.sidangTunda(n, sipp, masukan)]);
      if (!h.ok) throw new Error(h.sebab);
      dunia.JAM.sekarang = wita("2026-10-27 09:05");
      return h.butir[0].id;
    };
    const status = async (id: string) => (await baris("SELECT * FROM aleta_sidang_terjadwal WHERE id = ?", [id]))[0];

    it("belum waktunya: tidak ada yang dikerjakan; pada waktunya ditulis SEKARANG atas PP perkara, selesai, jejak lengkap", async () => {
      const h = await buat("tunda", "2026-10-27 09:00", [dunia.sidangTunda(1)]);
      if (!h.ok) throw new Error(h.sebab);
      const id = h.butir[0].id;
      dunia.JAM.sekarang = wita("2026-10-27 08:30");
      expect(await detakPelaksana(db, dunia.deps, {})).toEqual({ jalan: false, alasan: "tidak_ada" });
      expect(dunia.rekam.tulis).toHaveLength(0);

      dunia.JAM.sekarang = wita("2026-10-27 09:05");
      const d = await detakPelaksana(db, dunia.deps, {});
      expect(d).toMatchObject({ jalan: true, butirId: id, status: "selesai" });
      expect(dunia.rekam.tulis).toHaveLength(1);
      expect(dunia.rekam.tulis[0]).toMatchObject({
        kering: false,
        jamKerja: "sekarang",
        jadwalId: "9001",
        perkaraId: "101",
        alasanTunda: "Majelis hakim berhalangan hadir",
        tanggalBerikut: "2026-11-03",
        jamBerikut: "09:00",
        agendaBerikut: "Pembacaan gugatan",
        operator: PP,
        operatorNama: "Siti Aminah",
        operatorAkunSipp: "pp.satu",
        ip: "192.168.9.97",
      });
      // Tidak ada kata ALETA di muatan yang dikirim ke SIPP.
      expect(JSON.stringify(dunia.rekam.tulis)).not.toMatch(/aleta/i);
      const r = await status(id);
      expect(r).toMatchObject({ status: "selesai", klaim_oleh: "", hasil_ringkas: "Sidang ditunda ke 2026-11-03 pukul 09:00." });
      expect(String(r.selesai_pada)).not.toBe("");
      expect(JSON.parse(String(r.hasil_json))).toMatchObject({ sidangBerikutnya: { tanggal: "2026-11-03", jam: "09:00" }, atasNama: "pp.perkara" });
      const jejak = await baris("SELECT peristiwa, pelaku, hasil FROM aleta_sidang_terjadwal_jejak WHERE butir_id = ? ORDER BY waktu, id", [id]);
      expect(jejak.map((j) => j.peristiwa).sort()).toEqual(["dijadwalkan", "dimulai", "selesai"]);
      expect(jejak.find((j) => j.peristiwa === "selesai")).toMatchObject({ pelaku: "pelaksana server", hasil: "ok" });
      const audit = await baris("SELECT id FROM audit_logs WHERE action = 'SIDANG_TERJADWAL_SELESAI' AND entity_id = ?", [id]);
      expect(audit).toHaveLength(1);
      // Detak berikutnya tidak menulis lagi.
      expect(await detakPelaksana(db, dunia.deps, {})).toEqual({ jalan: false, alasan: "tidak_ada" });
      expect(dunia.rekam.tulis).toHaveLength(1);
    });

    it("saklar ALETA_SIDANG_TERJADWAL=0 mematikan pelaksana", async () => {
      await siapTunda();
      expect(pelaksanaNyala({ ALETA_SIDANG_TERJADWAL: "0" })).toBe(false);
      expect(pelaksanaNyala({})).toBe(true);
      expect(await detakPelaksana(db, dunia.deps, { ALETA_SIDANG_TERJADWAL: "0" })).toEqual({ jalan: false, alasan: "dimatikan" });
      expect(dunia.rekam.tulis).toHaveLength(0);
    });

    it("SIPP sudah memuat hasilnya saat dijalankan (ditunda petugas, diputus, hasil dicatat): DILEWATI, tidak ditulis", async () => {
      for (const [n, ubah, teks] of [
        [1, { ditunda: true }, /sudah ditunda/],
        [2, { putusan: "2026-10-27" }, /sudah diputus/],
        [3, { alasan: "Hadir semua pihak" }, /Hasil sidang ini sudah dicatat/],
      ] as const) {
        await db.run("DELETE FROM aleta_sidang_terjadwal");
        dunia.JAM.sekarang = wita("2026-10-27 08:00");
        const id = await siapTunda(n);
        Object.assign(dunia.tunda.get(String(9000 + n)) as SidangSipp, ubah);
        await detakPelaksana(db, dunia.deps, {});
        const r = await status(id);
        expect(r.status, `kasus ${n}`).toBe("dilewati");
        expect(String(r.hasil_ringkas)).toMatch(teks);
        expect(String(r.hasil_ringkas)).toMatch(/Tidak ditulis ulang/);
      }
      expect(dunia.rekam.tulis).toHaveLength(0);
    });

    it("tanggal sidang diubah di SIPP sejak dijadwalkan: GAGAL dengan sebab, tidak ditulis", async () => {
      const id = await siapTunda();
      dunia.tunda.get("9001")!.tanggal = "2026-10-29";
      await detakPelaksana(db, dunia.deps, {});
      const r = await status(id);
      expect(r.status).toBe("gagal");
      expect(String(r.hasil_ringkas)).toMatch(/Tanggal sidang di SIPP 2026-10-29/);
      expect(dunia.rekam.tulis).toHaveLength(0);
    });

    it("kode bot 'sudah ditunda' sesudah pemeriksaan (balapan) = dilewati; penolakan tetap lain = gagal dengan kalimat sebab", async () => {
      const id = await siapTunda(1);
      dunia.jawab.tulis = gagalBot("Sidang ini sudah ditunda oleh petugas lain.", "sidang_sudah_ditunda");
      await detakPelaksana(db, dunia.deps, {});
      expect((await status(id)).status).toBe("dilewati");

      await db.run("DELETE FROM aleta_sidang_terjadwal");
      dunia.JAM.sekarang = wita("2026-10-27 08:00");
      const id2 = await siapTunda(2);
      dunia.jawab.tulis = gagalBot("Panitera sidang perkara ini tidak tercatat di SIPP.", "panitera_sidang_tidak_ketemu");
      await detakPelaksana(db, dunia.deps, {});
      const r = await status(id2);
      expect(r.status).toBe("gagal");
      expect(r.hasil_ringkas).toBe("Panitera sidang perkara ini tidak tercatat di SIPP.");
      expect(Number(r.percobaan)).toBe(0);
    });

    it("galat sementara diulang dengan tunggu yang makin panjang, paling banyak 4 kali, lalu gagal; percobaan yang ternyata sudah masuk = dilewati", async () => {
      const id = await siapTunda();
      dunia.sementara.tulis = true;
      const kali: number[] = [];
      for (let i = 1; i <= 4; i += 1) {
        const d = await detakPelaksana(db, dunia.deps, {});
        expect(d.jalan, `percobaan ${i}`).toBe(true);
        const r = await status(id);
        kali.push(Number(r.percobaan));
        if (i < 4) {
          expect(r.status).toBe("menunggu");
          expect(String(r.hasil_ringkas)).toMatch(new RegExp(`percobaan ${i} dari 4`));
          expect(String(r.tunggu_sampai)).not.toBe("");
          // Belum waktunya diulang: detak berikutnya menunggu.
          expect(await detakPelaksana(db, dunia.deps, {})).toEqual({ jalan: false, alasan: "tidak_ada" });
          dunia.JAM.sekarang = new Date(dunia.JAM.sekarang.getTime() + (i === 1 ? 61 : i === 2 ? 181 : 421) * 1000);
        }
      }
      expect(kali).toEqual([1, 2, 3, 4]);
      const akhir = await status(id);
      expect(akhir.status).toBe("gagal");
      expect(String(akhir.hasil_ringkas)).toMatch(/Gagal setelah 4 percobaan: aleta_bot tidak merespons/);
      expect(dunia.rekam.tulis).toHaveLength(4);

      // Kasus lain: tulisan pertama sebenarnya masuk (timeout), pemeriksaan keadaan menangkapnya pada percobaan berikut.
      await db.run("DELETE FROM aleta_sidang_terjadwal");
      dunia.JAM.sekarang = wita("2026-10-27 08:00");
      const id2 = await siapTunda(2);
      dunia.sementara.tulis = true;
      await detakPelaksana(db, dunia.deps, {});
      dunia.tunda.get("9002")!.ditunda = true; // SIPP ternyata menulisnya
      dunia.JAM.sekarang = new Date(dunia.JAM.sekarang.getTime() + 61_000);
      await detakPelaksana(db, dunia.deps, {});
      const r2 = await status(id2);
      expect(r2.status).toBe("dilewati");
      expect(String(r2.hasil_ringkas)).toMatch(/kemungkinan tertulis pada percobaan sebelumnya/);
    });

    it("hari sidangnya lewat: KEDALUWARSA tanpa menghubungi bot, tidak pernah ditulis keesokan harinya", async () => {
      const id = await siapTunda();
      dunia.JAM.sekarang = wita("2026-10-28 00:30");
      await detakPelaksana(db, dunia.deps, {});
      const r = await status(id);
      expect(r.status).toBe("kedaluwarsa");
      expect(String(r.hasil_ringkas)).toMatch(/tidak ditulis di hari lain/);
      expect(dunia.rekam.tulis).toHaveLength(0);
      // Juga lewat jalankanButir langsung (butir yang sudah diklaim tepat melewati tengah malam).
      await db.run("DELETE FROM aleta_sidang_terjadwal");
      dunia.JAM.sekarang = wita("2026-10-27 08:00");
      const id2 = await siapTunda(2);
      await db.run("UPDATE aleta_sidang_terjadwal SET waktu_rencana = ? WHERE id = ?", [wita("2026-10-27 23:58").toISOString(), id2]);
      dunia.JAM.sekarang = wita("2026-10-27 23:59");
      // Pekerjaan diklaim pukul 23.59 tetapi bot baru dipanggil sesudah 00.00: jam diambil ulang saat menjalankan.
      let panggil = 0;
      const asli = dunia.deps.sekarang;
      dunia.deps.sekarang = () => {
        panggil += 1;
        return panggil >= 2 ? wita("2026-10-28 00:00") : asli();
      };
      await detakPelaksana(db, dunia.deps, {});
      expect((await status(id2)).status).toBe("kedaluwarsa");
      expect(dunia.rekam.tulis).toHaveLength(0);
    });

    it("hak penjadwal dinilai ULANG saat dijalankan: dicabut/nonaktif = gagal, tidak ada yang dikirim", async () => {
      const id = await siapTunda();
      dunia.hakDitolak.add(`tunda:${PP}`);
      await detakPelaksana(db, dunia.deps, {});
      const r = await status(id);
      expect(r.status).toBe("gagal");
      expect(String(r.hasil_ringkas)).toMatch(/Hak penjadwal sudah tidak berlaku/);
      expect(String(r.hasil_ringkas)).toMatch(/Tidak ada yang dikirim ke SIPP/);
      expect(dunia.rekam.tulis).toHaveLength(0);
      expect(dunia.rekam.kering).toHaveLength(1); // hanya yang saat menjadwalkan
    });

    it("keadaan sidang tidak terbaca (bot mati) = diulang, bukan gagal", async () => {
      const id = await siapTunda();
      dunia.sementara.keadaan = true;
      await detakPelaksana(db, dunia.deps, {});
      const r = await status(id);
      expect(r.status).toBe("menunggu");
      expect(Number(r.percobaan)).toBe(1);
      expect(dunia.rekam.tulis).toHaveLength(0);
    });
  });

  // ── Pelaksana: BAS ─────────────────────────────────────────────────────────

  describe("pelaksana - BAS", () => {
    const siapBas = async (n = 1, o: Partial<BasSipp> = {}, masukan: Record<string, unknown> = {}, isi?: Uint8Array, userId = PP) => {
      const s = dunia.sidangBas(n, o, masukan, isi);
      const h = await buat("bas", "2026-10-27 09:00", [s.butir], {}, s.berkas, userId);
      if (!h.ok) throw new Error(h.sebab);
      return h.butir[0].id;
    };
    const status = async (id: string) => (await baris("SELECT * FROM aleta_sidang_terjadwal WHERE id = ?", [id]))[0];

    it("pada waktunya diunggah lewat bot atas akun SIPP penjadwal; milikPerkara & peranPenekan diteruskan; berkas bersih; selesai", async () => {
      const id = await siapBas(1);
      dunia.JAM.sekarang = wita("2026-10-27 09:05");
      const d = await detakPelaksana(db, dunia.deps, {});
      expect(d).toMatchObject({ jalan: true, butirId: id, status: "selesai" });
      expect(dunia.rekam.unggah).toHaveLength(1);
      const m = dunia.rekam.unggah[0];
      expect(m).toMatchObject({
        perkaraId: "101",
        sidangId: "7001",
        nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
        olehUsername: "pp.satu",
        operator: "Siti Aminah",
        ip: "192.168.9.97",
        peranPenekan: "pp",
        milikPerkara: true,
        ganti: false,
      });
      expect(Buffer.from(m.basBase64, "base64").toString("utf8")).toContain("BERITA ACARA");
      expect(JSON.stringify({ ...m, basBase64: "" })).not.toMatch(/aleta/i);
      const r = await status(id);
      expect(r).toMatchObject({ status: "selesai", hasil_ringkas: "BAS sidang ke-2 terunggah ke SIPP." });
      // Berkas dihapus 7 hari sesudah selesai.
      const hapus = new Date(String(r.berkas_hapus_pada)).getTime();
      expect(hapus - dunia.JAM.sekarang.getTime()).toBe(BATAS_SIDANG.hapusHari * 24 * 3600_000);
      expect(dunia.bas.get("7001")?.adaBas).toBe(true);
    });

    it("e-Doc BAS sudah ada saat dijalankan = DILEWATI (tidak ditimpa); ganti tegas = diganti; kode bot sudah_ada = dilewati", async () => {
      const id = await siapBas(1);
      dunia.bas.get("7001")!.adaBas = true;
      dunia.bas.get("7001")!.jalur = "bas-orang.rtf";
      dunia.JAM.sekarang = wita("2026-10-27 09:05");
      await detakPelaksana(db, dunia.deps, {});
      const r = await status(id);
      expect(r.status).toBe("dilewati");
      expect(String(r.hasil_ringkas)).toMatch(/sudah ada di SIPP \(bas-orang\.rtf\).*tidak diganti/);
      expect(dunia.rekam.unggah).toHaveLength(0);

      await db.run("DELETE FROM aleta_sidang_terjadwal");
      dunia.JAM.sekarang = wita("2026-10-27 08:00");
      const idGanti = await siapBas(2, { adaBas: true, jalur: "lama.rtf" }, { ganti: true });
      dunia.JAM.sekarang = wita("2026-10-27 09:05");
      await detakPelaksana(db, dunia.deps, {});
      expect((await status(idGanti)).status).toBe("selesai");
      expect(dunia.rekam.unggah[0]).toMatchObject({ sidangId: "7002", ganti: true });

      await db.run("DELETE FROM aleta_sidang_terjadwal");
      dunia.JAM.sekarang = wita("2026-10-27 08:00");
      const idBalap = await siapBas(3);
      dunia.jawab.unggah = gagalBot("e-Doc BAS sidang ini sudah diisi orang lain di SIPP. Tidak diganti.", "sudah_ada");
      dunia.JAM.sekarang = wita("2026-10-27 09:05");
      await detakPelaksana(db, dunia.deps, {});
      expect((await status(idBalap)).status).toBe("dilewati");
    });

    it("penolakan tetap lain = gagal dengan kalimat sebab; galat sementara = diulang", async () => {
      const id = await siapBas(1);
      dunia.jawab.unggah = gagalBot("Sidang ini (2026-10-30) belum berlangsung - BAS-nya belum dapat diunggah.", "sidang_belum_berlangsung");
      dunia.JAM.sekarang = wita("2026-10-27 09:05");
      await detakPelaksana(db, dunia.deps, {});
      const r = await status(id);
      expect(r.status).toBe("gagal");
      expect(r.hasil_ringkas).toMatch(/belum berlangsung/);

      await db.run("DELETE FROM aleta_sidang_terjadwal");
      dunia.jawab.unggah = undefined;
      dunia.JAM.sekarang = wita("2026-10-27 08:00");
      const id2 = await siapBas(2);
      dunia.sementara.unggah = true;
      dunia.JAM.sekarang = wita("2026-10-27 09:05");
      await detakPelaksana(db, dunia.deps, {});
      const r2 = await status(id2);
      expect(r2).toMatchObject({ status: "menunggu", percobaan: 1 });
      expect(String(r2.hasil_ringkas)).toMatch(/Diulang otomatis \(percobaan 1 dari 4\)/);
    });

    it("pemeriksaan ULANG saat dijalankan: berkas hilang, isi berubah, PP bukan lagi PP perkara, tanggal sidang diubah, hak dicabut", async () => {
      const id = await siapBas(1);
      const [r0] = await baris("SELECT berkas_jalur FROM aleta_sidang_terjadwal WHERE id = ?", [id]);
      dunia.JAM.sekarang = wita("2026-10-27 09:05");
      // a. isi berubah (sidik jari tidak sama)
      await simpanBerkas("sdt-ganti", "rtf", basRtf("1/Pdt.G/2026/PA.Dgl"), { akar, kini: wita("2026-10-27 08:00") });
      await db.run("UPDATE aleta_sidang_terjadwal SET berkas_sha256 = ? WHERE id = ?", ["0".repeat(64), id]);
      await detakPelaksana(db, dunia.deps, {});
      expect(String((await status(id)).hasil_ringkas)).toMatch(/sidik jari tidak sama/);
      // b. berkas hilang
      await db.run("UPDATE aleta_sidang_terjadwal SET status = 'menunggu', berkas_sha256 = '' WHERE id = ?", [id]);
      await hapusBerkas(String(r0.berkas_jalur), akar);
      await detakPelaksana(db, dunia.deps, {});
      expect(String((await status(id)).hasil_ringkas)).toMatch(/tidak ditemukan di penyimpanan/);
      expect(dunia.rekam.unggah).toHaveLength(0);

      // c. PP bukan lagi PP perkara
      await db.run("DELETE FROM aleta_sidang_terjadwal");
      dunia.JAM.sekarang = wita("2026-10-27 08:00");
      const id2 = await siapBas(2);
      dunia.bas.get("7002")!.panitera = ["Budi Santoso"];
      dunia.JAM.sekarang = wita("2026-10-27 09:05");
      await detakPelaksana(db, dunia.deps, {});
      expect(String((await status(id2)).hasil_ringkas)).toMatch(/bukan perkara Anda sebagai Panitera Pengganti/);
      expect((await status(id2)).status).toBe("gagal");

      // d. tanggal sidang diubah
      await db.run("DELETE FROM aleta_sidang_terjadwal");
      dunia.JAM.sekarang = wita("2026-10-27 08:00");
      const id3 = await siapBas(3);
      dunia.bas.get("7003")!.tanggal = "2026-10-20";
      dunia.JAM.sekarang = wita("2026-10-27 09:05");
      await detakPelaksana(db, dunia.deps, {});
      expect(String((await status(id3)).hasil_ringkas)).toMatch(/jadwalnya sudah diubah/);

      // e. hak dicabut
      await db.run("DELETE FROM aleta_sidang_terjadwal");
      dunia.JAM.sekarang = wita("2026-10-27 08:00");
      const id4 = await siapBas(4);
      dunia.hakDitolak.add(`bas:${PP}`);
      dunia.JAM.sekarang = wita("2026-10-27 09:05");
      await detakPelaksana(db, dunia.deps, {});
      expect(String((await status(id4)).hasil_ringkas)).toMatch(/Hak penjadwal sudah tidak berlaku/);
      expect(dunia.rekam.unggah).toHaveLength(0);
    });

    it("bot mati saat membaca keadaan BAS = diulang; sidang tidak ada di SIPP = gagal", async () => {
      const id = await siapBas(1);
      dunia.sementara.cek = true;
      dunia.JAM.sekarang = wita("2026-10-27 09:05");
      await detakPelaksana(db, dunia.deps, {});
      expect(await status(id)).toMatchObject({ status: "menunggu", percobaan: 1 });
      dunia.sementara.cek = false;
      dunia.bas.delete("7001");
      dunia.JAM.sekarang = new Date(dunia.JAM.sekarang.getTime() + 61_000);
      await detakPelaksana(db, dunia.deps, {});
      expect((await status(id)).status).toBe("gagal");
    });

    it("BAS hanya di dalam jam kerja: di luar jam kerja/istirahat/hari libur menunggu jendela berikutnya; tunda tidak dibatasi", async () => {
      const s = dunia.sidangBas(1);
      dunia.JAM.sekarang = wita("2026-10-27 15:40");
      const h = await buat("bas", "2026-10-27 15:50", [s.butir], {}, s.berkas);
      if (!h.ok) throw new Error(h.sebab);
      const id = h.butir[0].id;
      dunia.JAM.sekarang = wita("2026-10-27 16:30");
      expect(await detakPelaksana(db, dunia.deps, {})).toEqual({ jalan: false, alasan: "tidak_ada" });
      dunia.JAM.sekarang = wita("2026-10-27 12:20");
      await db.run("UPDATE aleta_sidang_terjadwal SET waktu_rencana = ? WHERE id = ?", [wita("2026-10-27 12:10").toISOString(), id]);
      expect(await pilihButir(db, dunia.deps, dunia.JAM.sekarang)).toBeNull(); // istirahat
      dunia.JAM.sekarang = wita("2026-10-28 07:45");
      expect((await detakPelaksana(db, dunia.deps, {})).jalan).toBe(true);
      expect((await status(id)).status).toBe("selesai");
    });

    it("jeda antar pekerjaan pemilik yang sama dihormati; satu pekerjaan per detak; pemilik lain tidak ikut tertahan", async () => {
      const s1 = dunia.sidangBas(1);
      const s2 = dunia.sidangBas(2);
      const s3 = dunia.sidangBas(3, { panitera: ["Budi Santoso"] });
      dunia.akun[PP2] = { ok: true, username: "pp.dua", milik: ["pp.dua"] };
      const h = await buat("bas", "2026-10-27 09:00", [s1.butir, s2.butir], { jedaMin: 120, jedaMaks: 120 }, { ...s1.berkas, ...s2.berkas });
      const h3 = await buat("bas", "2026-10-27 09:00", [s3.butir], {}, s3.berkas, PP2);
      if (!h.ok || !h3.ok) throw new Error("gagal menjadwalkan");
      // Semuanya sudah jatuh tempo.
      dunia.JAM.sekarang = wita("2026-10-27 10:00");
      const a = await detakPelaksana(db, dunia.deps, {});
      expect(a.jalan).toBe(true);
      expect(dunia.rekam.unggah).toHaveLength(1);
      // 30 detik kemudian: pekerjaan PP berikutnya masih dalam jeda 120 detik; PP2 boleh jalan.
      dunia.JAM.sekarang = new Date(dunia.JAM.sekarang.getTime() + 30_000);
      const b = await detakPelaksana(db, dunia.deps, {});
      expect(b).toMatchObject({ jalan: true, nomorPerkara: "3/Pdt.G/2026/PA.Dgl" });
      dunia.JAM.sekarang = new Date(dunia.JAM.sekarang.getTime() + 30_000);
      expect(await detakPelaksana(db, dunia.deps, {})).toEqual({ jalan: false, alasan: "tidak_ada" });
      // Lewat jeda: giliran berikutnya.
      dunia.JAM.sekarang = new Date(dunia.JAM.sekarang.getTime() + 120_000);
      expect(await detakPelaksana(db, dunia.deps, {})).toMatchObject({ jalan: true, nomorPerkara: "2/Pdt.G/2026/PA.Dgl" });
      expect(dunia.rekam.unggah.map((m) => m.sidangId)).toEqual(["7001", "7003", "7002"]);
    });

    it("BAS yang tak sempat dikerjakan 3 hari sesudah jam rencananya KEDALUWARSA (tidak ditulis diam-diam)", async () => {
      const id = await siapBas(1);
      dunia.JAM.sekarang = wita("2026-10-31 09:00");
      expect(await kedaluwarsakan(db, dunia.JAM.sekarang)).toBe(1);
      const r = await status(id);
      expect(r.status).toBe("kedaluwarsa");
      expect(String(r.hasil_ringkas)).toMatch(/Tekan Ulangi/);
      expect(dunia.rekam.unggah).toHaveLength(0);
    });
  });

  // ── Pelaksana: klaim, pemulihan, pembersihan ───────────────────────────────

  describe("pelaksana - klaim, pemulihan, pembersihan", () => {
    it("klaim bersyarat: hanya satu pemegang; pembaruan dengan status lama yang sudah berubah ditolak", async () => {
      const h = await buat("tunda", "2026-10-27 09:00", [dunia.sidangTunda(1)]);
      if (!h.ok) throw new Error(h.sebab);
      const id = h.butir[0].id;
      const a = await ubahButir(db, id, { status: "jalan", klaim_oleh: "server" }, { syaratStatus: ["menunggu"] });
      const b = await ubahButir(db, id, { status: "jalan", klaim_oleh: "server-lain" }, { syaratStatus: ["menunggu"] });
      expect(a?.klaim_oleh).toBe("server");
      expect(b).toBeNull();
      expect((await ubahButir(db, id, { klaim_oleh: "" }, { syaratKlaim: "bukan-pemegang" }))).toBeNull();
      expect((await ubahButir(db, id, { klaim_oleh: "" }, { syaratKlaim: "server" }))?.klaim_oleh).toBe("");
    });

    it("pulihkanMacet: yang masa pegangnya habis kembali menunggu (percobaan+1); terlalu sering = gagal; yang masih dipegang dibiarkan", async () => {
      const hs = await Promise.all([1, 2, 3].map((n) => buat("tunda", "2026-10-27 09:00", [dunia.sidangTunda(n)])));
      const ids = hs.map((h) => (h.ok ? h.butir[0].id : ""));
      dunia.JAM.sekarang = wita("2026-10-27 09:30");
      const lewat = new Date(dunia.JAM.sekarang.getTime() - 60_000).toISOString();
      const nanti = new Date(dunia.JAM.sekarang.getTime() + 300_000).toISOString();
      await ubahButir(db, ids[0], { status: "jalan", klaim_oleh: "server", klaim_sampai: lewat });
      await ubahButir(db, ids[1], { status: "jalan", klaim_oleh: "server", klaim_sampai: lewat, percobaan: BATAS_SIDANG.percobaanMaks - 1 });
      await ubahButir(db, ids[2], { status: "jalan", klaim_oleh: "server", klaim_sampai: nanti });
      expect(await pulihkanMacet(db, dunia.JAM.sekarang)).toBe(2);
      const baru = await baris("SELECT id, status, percobaan, klaim_oleh, hasil_ringkas FROM aleta_sidang_terjadwal ORDER BY id");
      const per = Object.fromEntries(baru.map((r) => [String(r.id), r]));
      expect(per[ids[0]]).toMatchObject({ status: "menunggu", percobaan: 1, klaim_oleh: "" });
      expect(String(per[ids[0]].hasil_ringkas)).toMatch(/terputus di tengah jalan.*tidak ditimpa/);
      expect(per[ids[1]].status).toBe("gagal");
      expect(String(per[ids[1]].hasil_ringkas)).toMatch(/Gagal setelah 4 percobaan/);
      expect(per[ids[2]]).toMatchObject({ status: "jalan", klaim_oleh: "server" });
    });

    it("bersihkanBerkas: berkas yang waktunya habis dihapus dari cakram; yang masih menunggu atau belum waktunya tidak", async () => {
      const s1 = dunia.sidangBas(1);
      const s2 = dunia.sidangBas(2);
      const s3 = dunia.sidangBas(3);
      const h = await buat("bas", "2026-10-27 09:00", [s1.butir, s2.butir, s3.butir], {}, { ...s1.berkas, ...s2.berkas, ...s3.berkas });
      if (!h.ok) throw new Error(h.sebab);
      expect(berkasDiCakram()).toHaveLength(3);
      const lampau = wita("2026-10-27 07:00").toISOString();
      const depan = wita("2026-11-27 07:00").toISOString();
      await db.run("UPDATE aleta_sidang_terjadwal SET status = 'selesai', berkas_hapus_pada = ? WHERE id = ?", [lampau, h.butir[0].id]);
      await db.run("UPDATE aleta_sidang_terjadwal SET status = 'dibatalkan', berkas_hapus_pada = ? WHERE id = ?", [depan, h.butir[1].id]);
      await db.run("UPDATE aleta_sidang_terjadwal SET berkas_hapus_pada = ? WHERE id = ?", [lampau, h.butir[2].id]); // masih menunggu
      expect(await bersihkanBerkas(db, dunia.deps, dunia.JAM.sekarang)).toBe(1);
      expect(berkasDiCakram()).toHaveLength(2);
      const [r] = await baris("SELECT berkas_jalur, berkas_hapus_pada FROM aleta_sidang_terjadwal WHERE id = ?", [h.butir[0].id]);
      expect(r).toMatchObject({ berkas_jalur: "", berkas_hapus_pada: "" });
    });

    it("detak tidak pernah melempar walau basis data bermasalah", async () => {
      const rusak = { ...db, queryAll: async () => { throw new Error("basis data mati"); } } as unknown as AletaDatabase;
      const d = await detakPelaksana(rusak, dunia.deps, {});
      expect(d).toMatchObject({ jalan: false, alasan: "galat" });
    });
  });
});

// Penjaga kecil: tidak ada berkas kode sidang-terjadwal yang menulis kata ALETA ke muatan SIPP selain komentar/catatan.
describe("tidak ada kata ALETA di jalur tulis ke SIPP", () => {
  it("badanTunda dan muatan unggah BAS tidak memuat ALETA", async () => {
    const { badanTunda } = await import("@/server/modules/sidang-terjadwal/layanan");
    const badan = badanTunda({
      jadwalId: "1",
      perkaraId: "2",
      muatan: { alasanTunda: "Hakim berhalangan", tanggalBerikut: "2026-11-03", jamBerikut: "09:00", agendaBerikut: "Jawaban" },
      aktorId: "usr-1",
      aktorNama: "Siti Aminah",
      akunSipp: "pp.satu",
      ip: "192.168.9.97",
      kering: false,
    });
    expect(JSON.stringify(badan)).not.toMatch(/aleta/i);
    expect(badan).toMatchObject({ kering: false, jamKerja: "sekarang" });
    expect(badanTunda({ jadwalId: "1", perkaraId: "2", muatan: { alasanTunda: "a", tanggalBerikut: "2026-11-03", jamBerikut: "09:00", agendaBerikut: "b" }, aktorId: "u", aktorNama: "n", akunSipp: "", ip: "", kering: true })).not.toHaveProperty("jamKerja");
  });

  it("msKeWita tersedia untuk pembanding (sanity)", () => {
    expect(msKeWita(witaKeMs("2026-10-27 09:00"))).toBe("2026-10-27 09:00:00");
  });
});
