// @vitest-environment node
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ringkasStatus, type BahanRingkas } from "@/lib/ringkas-status";
import type { BahanRingkasanSalin } from "@/lib/ringkasan-salin";

// Pembukti gigitan: ALETA_UJI_RINGKASAN_SALIN menunjuk salinan ringkasan-salin
// di luar repo (misalnya versi sebelum perbaikan). Tanpa itu, yang asli.
const { susunRingkasanSalin } = (
  process.env.ALETA_UJI_RINGKASAN_SALIN
    ? await import(/* @vite-ignore */ process.env.ALETA_UJI_RINGKASAN_SALIN)
    : await import("@/lib/ringkasan-salin")
) as typeof import("@/lib/ringkasan-salin");

/**
 * ============================================================================
 * MAJELIS PEMERIKSA, BUKAN MAJELIS IKRAR - DIJALANKAN ATAS SIPP TIRUAN
 * ============================================================================
 *
 * Permintaan pengguna 27 September 2026: "perbaiki kolom majelis ikrar di
 * status perkara". SIPP menonaktifkan majelis pemeriksaan (tahapan 10) begitu
 * majelis ikrar talak (tahapan 18) ditetapkan, dan layar Status Perkara - yang
 * membaca penunjukan aktif - menulis majelis IKRAR sebagai majelis perkara.
 *
 * Yang dijalankan SUNGGUHAN di sini:
 *   - majelisPemeriksaService (bot) - aturan bersama rekap, Status Perkara,
 *     dan eviden SKP - atas baris penunjukan tiruan berbentuk kasus nyata
 *     sipp_donggala (perkara_id 385, 1895, 2373, 4613, 703, 1);
 *   - statusLengkap (bot) utuh, dengan db_config dan bot_db_config ditiru:
 *     muatan majelis/panitera/jurusita/ikrar yang dikirim ke layar;
 *   - susunRingkasanSalin (portal) atas muatan itu.
 *
 * Tiruan basis datanya mengembalikan HANYA kolom yang dipilih kuerinya
 * ("AS alias") - kolom yang lupa dipilih tidak diam-diam terisi oleh uji.
 *
 * Pembukti gigitan (tanpa menyentuh berkas repo): ALETA_UJI_SUMBER_MAJELIS
 * dan ALETA_UJI_SUMBER_STATUS menunjuk berkas sumber PENGGANTI - misalnya
 * versi sebelum perbaikan dari git, atau salinan bermutan - yang dikompilasi
 * pada jalur aslinya di singgahan require; ALETA_UJI_RINGKASAN_SALIN
 * menunjuk salinan ringkasan-salin yang diimpor sebagai gantinya.
 *
 * Nama orang di sini karangan; nomor dan tanggalnya meniru kasus terukur.
 */

const require_ = createRequire(import.meta.url);
const AKAR_BOT = path.resolve(process.cwd(), "../aleta_bot");
const JALUR_DB = require_.resolve(path.join(AKAR_BOT, "db_config"));
const JALUR_BOT_DB = require_.resolve(path.join(AKAR_BOT, "bot_db_config"));
const JALUR_MAJELIS = require_.resolve(path.join(AKAR_BOT, "services/majelisPemeriksaService"));
const JALUR_STATUS = require_.resolve(path.join(AKAR_BOT, "services/sippStatusPerkaraService"));
const JALUR_SKEMA = require_.resolve(path.join(AKAR_BOT, "services/sippSkemaService"));

// ---------------------------------------------------------------------------
// SIPP tiruan
// ---------------------------------------------------------------------------

type Baris = Record<string, unknown>;

type Keadaan = {
  hakim: Baris[];
  panitera: Baris[];
  jurusita: Baris[];
  putusan: Array<{ perkaraId: number; putus: string }>;
  borang: Baris[];
  /** Kolom perkara_ikrar_talak yang "ada" di skema; [] = SIPP tanpa tabel itu. */
  kolomBorang: string[];
  perkara: Baris | null;
  /** Kueri yang dijawab dengan galat - meniru SIPP yang gagal dibaca. */
  gagal: RegExp | null;
};

const KOLOM_BORANG_SIPP = [
  "perkara_id",
  "majelis_hakim_id",
  "majelis_hakim_text",
  "majelis_hakim_nama",
  "panitera_pengganti_id",
  "panitera_pengganti_text",
  "jurusita_id",
  "jurusita_text",
];

let keadaan: Keadaan = kosong();
const kueri: Array<{ sql: string; params: unknown[] }> = [];

function kosong(): Keadaan {
  return {
    hakim: [],
    panitera: [],
    jurusita: [],
    putusan: [],
    borang: [],
    kolomBorang: KOLOM_BORANG_SIPP,
    perkara: null,
    gagal: null,
  };
}

/** Hanya kunci yang dipilih kuerinya ("AS kunci") yang ikut kembali. */
function sesuaiAlias(sql: string, baris: Baris): Baris {
  const hasil: Baris = {};
  for (const [k, v] of Object.entries(baris)) {
    if (new RegExp(`\\bAS\\s+${k}\\b`).test(sql)) hasil[k] = v;
  }
  return hasil;
}

function milik(baris: Baris[], params: unknown[]) {
  const ids = new Set(params.map((x) => String(x)));
  return baris.filter((b) => ids.has(String(b.perkaraId)));
}

function jawab(sqlMentah: string, params: unknown[]): Baris[] {
  const sql = sqlMentah.replace(/\s+/g, " ");
  if (keadaan.gagal && keadaan.gagal.test(sql)) throw new Error("SIPP tiruan: kueri ini sengaja gagal");

  if (/information_schema\.COLUMNS/.test(sql)) {
    return keadaan.kolomBorang.map((kolom) => ({ tabel: "perkara_ikrar_talak", kolom }));
  }
  // ---- modul bersama: seluruh baris penunjukan per potongan id ----
  if (/FROM perkara_hakim_pn h WHERE h\.perkara_id IN \(/.test(sql)) {
    return milik(keadaan.hakim, params).map((b) => sesuaiAlias(sql, b));
  }
  if (/FROM perkara_panitera_pn h WHERE h\.perkara_id IN \(/.test(sql)) {
    return milik(keadaan.panitera, params).map((b) => sesuaiAlias(sql, b));
  }
  if (/FROM perkara_jurusita h WHERE h\.perkara_id IN \(/.test(sql)) {
    return milik(keadaan.jurusita, params).map((b) => sesuaiAlias(sql, b));
  }
  if (/FROM perkara_putusan pu WHERE pu\.perkara_id IN \(.*GROUP BY pu\.perkara_id/.test(sql)) {
    return milik(keadaan.putusan, params).map((b) => sesuaiAlias(sql, b));
  }
  if (/FROM perkara_ikrar_talak t WHERE t\.perkara_id IN \(/.test(sql)) {
    return milik(keadaan.borang, params).map((b) => sesuaiAlias(sql, b));
  }
  // ---- jalur Jadwal Sidang: penunjukan AKTIF (majelisPerkara, petugasPerkara) ----
  if (/FROM perkara_hakim_pn hk WHERE hk\.perkara_id = \? AND hk\.aktif = 'Y'/.test(sql)) {
    return milik(keadaan.hakim, params)
      .filter((b) => b.aktif === "Y")
      .map((b) => ({ id: b.orang, kode: b.kode, nama: b.nama, jabatan: b.jabatanNama, urutan: b.urutan }));
  }
  if (/FROM perkara_panitera_pn pn WHERE pn\.perkara_id = \? AND pn\.aktif = 'Y'/.test(sql)) {
    return milik(keadaan.panitera, params)
      .filter((b) => b.aktif === "Y")
      .map((b) => ({ id: b.orang, kode: b.kode, nama: b.nama }));
  }
  if (/FROM perkara_jurusita js WHERE js\.perkara_id = \? AND js\.aktif = 'Y'/.test(sql)) {
    return milik(keadaan.jurusita, params)
      .filter((b) => b.aktif === "Y")
      .map((b) => ({ id: b.orang, kode: b.kode, nama: b.nama }));
  }
  // ---- identitas perkara (statusLengkap, rincianSidang) ----
  if (keadaan.perkara && /FROM perkara p WHERE p\.nomor_perkara = \?/.test(sql)) {
    const baris: Baris = {};
    for (const m of sql.matchAll(/\bp\.(\w+)\s+AS\s+(\w+)/g)) {
      if (m[1] in keadaan.perkara) baris[m[2]] = keadaan.perkara[m[1]];
    }
    return [baris];
  }
  return [];
}

function modulTiruan(jalur: string, exports: unknown) {
  const m = new Module(jalur);
  m.filename = jalur;
  m.loaded = true;
  m.exports = exports;
  require_.cache[jalur] = m;
}

/** Memuat modul bot; bila `sumber` diberikan, teks itu dikompilasi pada jalur aslinya. */
function tanam(jalur: string, sumber?: string) {
  delete require_.cache[jalur];
  if (!sumber) return require_(jalur);
  const m = new Module(jalur) as Module & { _compile: (teks: string, nama: string) => void; paths: string[] };
  m.filename = jalur;
  m.paths = (Module as unknown as { _nodeModulePaths: (d: string) => string[] })._nodeModulePaths(path.dirname(jalur));
  m._compile(fs.readFileSync(sumber, "utf8"), jalur);
  m.loaded = true;
  require_.cache[jalur] = m;
  return m.exports;
}

type Orang = { kedudukan?: string; nama: string; hakimId?: number | null; paniteraId?: number | null; jurusitaId?: number | null; sumber?: string; tahapanId?: number | null; kode?: string };
type Entri = {
  tanggalPutusan: string | null;
  pemeriksa: { hakim: Orang[]; panitera: Orang[]; jurusita: Orang[] };
  ikrar: { hakim: Orang[]; panitera: Orang[]; jurusita: Orang[] } | null;
  penetapanIkrar: { hakim: Orang[]; panitera: Orang[]; jurusita: Orang[] } | null;
};
type Majelis = {
  penunjukanPerkaraBanyak: (ids: unknown[]) => Promise<Map<string, Entri>>;
  ikrarLengkap: (e: Entri) => { hakim: Orang[]; panitera: Orang[]; jurusita: Orang[] } | null;
  POTONGAN_IN: number;
};

let majelis: Majelis;
// Layanan CommonJS bot - bentuk muatannya diperiksa oleh uji di bawah, bukan tipe.
let layananStatus: any;
let skema: { lupakan: () => void };

beforeAll(() => {
  const dbTiruan = {
    query(sql: string, params: unknown[] | ((...a: unknown[]) => void), cb?: (galat: unknown, rows?: unknown[]) => void) {
      const panggil = typeof params === "function" ? (params as (g: unknown, r?: unknown[]) => void) : cb!;
      const isian = Array.isArray(params) ? params : [];
      kueri.push({ sql: String(sql), params: isian });
      try {
        panggil(null, jawab(String(sql), isian));
      } catch (galat) {
        panggil(galat);
      }
    },
    escape: (v: unknown) => `'${String(v).replace(/'/g, "''")}'`,
  };
  modulTiruan(JALUR_DB, dbTiruan);
  // Basis data ALETA (e-Court, konteks) - kosong, tanpa jaringan.
  modulTiruan(JALUR_BOT_DB, {
    query(_sql: string, params: unknown, cb?: (galat: unknown, rows?: unknown[]) => void) {
      const panggil = typeof params === "function" ? (params as (g: unknown, r?: unknown[]) => void) : cb!;
      panggil(null, []);
    },
    escape: (v: unknown) => `'${String(v)}'`,
  });
  skema = tanam(JALUR_SKEMA);
  majelis = tanam(JALUR_MAJELIS, process.env.ALETA_UJI_SUMBER_MAJELIS);
  layananStatus = tanam(JALUR_STATUS, process.env.ALETA_UJI_SUMBER_STATUS);
});

beforeEach(() => {
  keadaan = kosong();
  kueri.length = 0;
  skema.lupakan();
});

// ---------------------------------------------------------------------------
// Pembentuk baris penunjukan (bentuk alias kueri modul)
// ---------------------------------------------------------------------------

let idBaris = 1000;
function hk(
  perkaraId: number,
  tahapan: number,
  urutan: number,
  jabatan: number,
  orang: number,
  nama: string,
  aktif: "Y" | "T",
  penetapan: string,
  tidakAktif: string | null = null
): Baris {
  idBaris += 1;
  const jabatanNama = jabatan === 1 ? "Hakim Ketua" : jabatan === 3 ? "Hakim Tunggal" : "Hakim Anggota";
  return { perkaraId, tahapan, urutan, jabatan, jabatanNama, orang, nama, kode: `H${orang}`, aktif, penetapan, tidakAktif, id: idBaris };
}
function pt(
  perkaraId: number,
  tahapan: number,
  orang: number,
  nama: string,
  aktif: "Y" | "T",
  penetapan: string,
  tidakAktif: string | null = null
): Baris {
  idBaris += 1;
  return { perkaraId, tahapan, urutan: 1, jabatan: null, orang, nama, kode: `P${orang}`, aktif, penetapan, tidakAktif, id: idBaris };
}

const ids = (daftar: Orang[], kunci: "hakimId" | "paniteraId" | "jurusitaId" = "hakimId") => daftar.map((x) => x[kunci]);
const kedudukan = (daftar: Orang[]) => daftar.map((x) => x.kedudukan);

/** 385: pemeriksa dinonaktifkan TANPA tanggal saat majelis ikrar ditetapkan. */
function kasus385() {
  keadaan.hakim.push(
    hk(385, 10, 1, 1, 4, "Arasy Latif", "T", "2016-01-05"),
    hk(385, 10, 2, 2, 1, "Amar Ma'ruf", "T", "2016-01-05"),
    hk(385, 10, 3, 2, 6, "Ruhana Faried", "T", "2016-01-05"),
    hk(385, 18, 1, 1, 9, "Ulfah", "Y", "2016-03-07"),
    hk(385, 18, 2, 2, 1, "Amar Ma'ruf", "Y", "2016-03-07"),
    hk(385, 18, 3, 2, 6, "Ruhana Faried", "Y", "2016-03-07")
  );
  keadaan.panitera.push(pt(385, 10, 4, "Imayanti, S.H.", "Y", "2016-01-05"));
  keadaan.jurusita.push(pt(385, 10, 2, "Muh. Sam'an", "Y", "2016-01-05"));
  keadaan.putusan.push({ perkaraId: 385, putus: "2016-01-28" });
  keadaan.borang.push({
    perkaraId: 385,
    majelisId: "9,1,6",
    majelisTeks: "Hakim Ketua: Ulfah, S.Ag., M.H.</br>Hakim Anggota 1: Amar Ma'ruf, S.Ag.</br>Hakim Anggota 2: Ruhana Faried",
    paniteraId: null,
    paniteraTeks: "Imayanti, S.H.",
    jurusitaId: 2,
    jurusitaTeks: "Jurusita: Muh. Sam'an",
  });
}

/** 1895: pemeriksa "diganti" SESUDAH putusan oleh majelis ikrarnya. */
function kasus1895() {
  keadaan.hakim.push(
    hk(1895, 10, 1, 1, 9, "Ulfah", "T", "2017-07-13", "2017-09-06"),
    hk(1895, 10, 1, 1, 1, "Amar Ma'ruf", "T", "2017-09-06"),
    hk(1895, 10, 2, 2, 1, "Amar Ma'ruf", "T", "2017-07-13", "2017-09-06"),
    hk(1895, 10, 2, 2, 7, "Rustam", "T", "2017-09-06"),
    hk(1895, 10, 3, 2, 6, "Ruhana Faried", "T", "2017-07-13", "2017-09-06"),
    hk(1895, 10, 3, 2, 6, "Ruhana Faried", "T", "2017-09-06"),
    hk(1895, 18, 1, 1, 1, "Amar Ma'ruf", "Y", "2017-09-07"),
    hk(1895, 18, 2, 2, 7, "Rustam", "Y", "2017-09-07"),
    hk(1895, 18, 3, 2, 6, "Ruhana Faried", "Y", "2017-09-07")
  );
  keadaan.putusan.push({ perkaraId: 1895, putus: "2017-08-16" });
}

/** 2373: pergantian sungguhan sebelum putusan, lalu pengganti sesudah putusan yang TETAP aktif. */
function kasus2373() {
  keadaan.hakim.push(
    hk(2373, 10, 1, 1, 7, "Rustam", "T", "2018-02-15", "2018-05-02"),
    hk(2373, 10, 1, 1, 11, "M. Tang", "T", "2018-05-02"),
    hk(2373, 10, 1, 3, 7, "Rustam", "Y", "2018-06-25"),
    hk(2373, 10, 2, 2, 1, "Amar Ma'ruf", "T", "2018-02-15", "2018-05-02"),
    hk(2373, 10, 2, 2, 1, "Amar Ma'ruf", "T", "2018-05-02"),
    hk(2373, 10, 3, 2, 6, "Ruhana Faried", "T", "2018-02-15", "2018-05-02"),
    hk(2373, 10, 3, 2, 7, "Rustam", "T", "2018-05-02"),
    hk(2373, 18, 1, 1, 11, "M. Tang", "T", "2018-07-09", "2018-06-25"),
    hk(2373, 18, 2, 2, 1, "Amar Ma'ruf", "T", "2018-07-09", "2018-06-25"),
    hk(2373, 18, 3, 2, 7, "Rustam", "T", "2018-07-09", "2018-06-25")
  );
  keadaan.putusan.push({ perkaraId: 2373, putus: "2018-06-05" });
  keadaan.borang.push({
    perkaraId: 2373,
    majelisId: "7",
    majelisTeks: "Hakim Tunggal: Rustam, S.H.I., M.H.",
    paniteraId: 11,
    paniteraTeks: "Panitera Pengganti: Siti Rabiyah",
    jurusitaId: 29,
    jurusitaTeks: "Juru Sita Pengganti: Fachrudin",
  });
}

/** 4613: pengganti sesudah putusan yang masih AKTIF; majelis ikrarnya kemudian T. */
function kasus4613() {
  keadaan.hakim.push(
    hk(4613, 10, 1, 1, 13, "Hasmah", "T", "2019-11-11"),
    hk(4613, 10, 1, 1, 17, "Nurbaya", "Y", "2020-11-20"),
    hk(4613, 10, 2, 2, 14, "Syaokany", "T", "2019-11-11"),
    hk(4613, 10, 2, 2, 18, "Mohamad Arif", "Y", "2020-11-20"),
    hk(4613, 10, 3, 2, 15, "Ihsan", "T", "2019-11-11"),
    hk(4613, 10, 3, 2, 19, "Zuhairah", "Y", "2020-11-20"),
    hk(4613, 18, 1, 1, 13, "Hasmah", "T", "2019-12-23", "2020-11-20"),
    hk(4613, 18, 2, 2, 14, "Syaokany", "T", "2019-12-23", "2020-11-20"),
    hk(4613, 18, 3, 2, 15, "Ihsan", "T", "2019-12-23", "2020-11-20")
  );
  keadaan.putusan.push({ perkaraId: 4613, putus: "2019-12-03" });
}

/** 703: baris AKTIF yang tanggal tidak aktifnya terisi tetap menjabat; panitera diganti sebelum putusan. */
function kasus703() {
  keadaan.hakim.push(
    hk(703, 10, 1, 1, 8, "Tumisah", "Y", "2016-06-03", "2016-10-05"),
    hk(703, 10, 2, 2, 9, "Ulfah", "Y", "2016-06-03", "2016-10-05"),
    hk(703, 10, 3, 2, 7, "Rustam", "Y", "2016-06-03", "2016-10-05")
  );
  keadaan.panitera.push(
    pt(703, 10, 2, "Bulgis", "T", "2016-06-08", "2016-10-05"),
    pt(703, 10, 11, "Siti Rabiyah", "Y", "2016-10-05")
  );
  keadaan.putusan.push({ perkaraId: 703, putus: "2016-10-11" });
}

// ===========================================================================
// 1. MODUL BERSAMA
// ===========================================================================

describe("majelisPemeriksaService.penunjukanPerkaraBanyak", () => {
  it("385: pemeriksa yang dinonaktifkan tanpa tanggal tetap pemeriksa; majelis ikrar tersendiri", async () => {
    kasus385();
    const e = (await majelis.penunjukanPerkaraBanyak([385])).get("385")!;
    expect(e.tanggalPutusan).toBe("2016-01-28");
    expect(ids(e.pemeriksa.hakim)).toEqual([4, 1, 6]);
    expect(kedudukan(e.pemeriksa.hakim)).toEqual(["Hakim Ketua", "Hakim Anggota 1", "Hakim Anggota 2"]);
    expect(e.pemeriksa.hakim[0]).toMatchObject({ nama: "Arasy Latif", kode: "H4", urutan: 1, tahapanId: 10 });
    expect(ids(e.pemeriksa.panitera, "paniteraId")).toEqual([4]);
    expect(ids(e.pemeriksa.jurusita, "jurusitaId")).toEqual([2]);
    expect(e.ikrar).not.toBeNull();
    expect(ids(e.ikrar!.hakim)).toEqual([9, 1, 6]);
    expect(e.ikrar!.hakim[0]).toMatchObject({ kedudukan: "Hakim Ketua", nama: "Ulfah", tahapanId: 18 });
    // SIPP tidak menulis panitera/juru sita ikrar ke tabel penunjukan.
    expect(e.ikrar!.panitera).toEqual([]);
    expect(e.ikrar!.jurusita).toEqual([]);
  });

  it("1895: pengganti sesudah putusan BUKAN pemeriksa - ketua pemeriksa tetap yang menjabat pada hari putusan", async () => {
    kasus1895();
    const e = (await majelis.penunjukanPerkaraBanyak(["1895"])).get("1895")!;
    expect(ids(e.pemeriksa.hakim)).toEqual([9, 1, 6]);
    expect(e.pemeriksa.hakim[0].kedudukan).toBe("Hakim Ketua");
    expect(e.pemeriksa.hakim[0].nama).toBe("Ulfah");
    expect(ids(e.ikrar!.hakim)).toEqual([1, 7, 6]);
  });

  it("2373 dan 4613: pengganti sesudah putusan yang masih aktif tidak menggeser pemeriksa; ikrar tanpa baris aktif = null", async () => {
    kasus2373();
    kasus4613();
    const peta = await majelis.penunjukanPerkaraBanyak([2373, 4613]);
    const a = peta.get("2373")!;
    // Rustam diganti SEBELUM putusan (kursi 1) - M. Tang yang menjabat pada hari itu.
    expect(ids(a.pemeriksa.hakim)).toEqual([11, 1, 7]);
    expect(kedudukan(a.pemeriksa.hakim)).toEqual(["Hakim Ketua", "Hakim Anggota 1", "Hakim Anggota 2"]);
    expect(a.ikrar).toBeNull();
    const b = peta.get("4613")!;
    expect(ids(b.pemeriksa.hakim)).toEqual([13, 14, 15]);
    expect(b.ikrar).toBeNull();
  });

  it("703: baris aktif bertanggal tidak aktif tetap menjabat; panitera yang diganti sebelum putusan tidak", async () => {
    kasus703();
    const e = (await majelis.penunjukanPerkaraBanyak([703])).get("703")!;
    expect(ids(e.pemeriksa.hakim)).toEqual([8, 9, 7]);
    expect(ids(e.pemeriksa.panitera, "paniteraId")).toEqual([11]);
    expect(e.ikrar).toBeNull();
    expect(e.penetapanIkrar).toBeNull();
  });

  it("baris AKTIF bertanggal basi tetap menjabat walau kursi lain menjabat biasa (bentuk 703 bercampur)", async () => {
    // Pada 703 murni ketiga kursinya aktif, jadi jalur cadangan "yang aktif"
    // memberi jawaban yang sama - kasus ini yang membedakan aturannya.
    keadaan.hakim.push(
      hk(704, 10, 1, 1, 8, "Tumisah", "Y", "2016-06-03", "2016-10-05"),
      hk(704, 10, 2, 2, 9, "Ulfah", "Y", "2016-06-03", "2016-10-05"),
      hk(704, 10, 3, 2, 7, "Rustam", "T", "2016-06-03")
    );
    keadaan.putusan.push({ perkaraId: 704, putus: "2016-10-11" });
    const e = (await majelis.penunjukanPerkaraBanyak([704])).get("704")!;
    expect(ids(e.pemeriksa.hakim)).toEqual([8, 9, 7]);
  });

  it("belum putus: penunjukan yang aktif; bila tak satu pun aktif, baris terakhir tiap kursi", async () => {
    keadaan.hakim.push(
      hk(9001, 10, 1, 1, 21, "Ketua Lama", "T", "2026-07-01", "2026-08-01"),
      hk(9001, 10, 1, 1, 22, "Ketua Baru", "Y", "2026-08-01"),
      hk(9001, 10, 2, 2, 23, "Anggota Satu", "Y", "2026-07-01"),
      hk(9001, 10, 3, 2, 24, "Anggota Dua", "Y", "2026-07-01"),
      // 9002: seluruhnya T tanpa tanggal - kursi 1 punya dua baris.
      hk(9002, 10, 1, 1, 31, "Ketua Awal", "T", "2026-06-01", "2026-06-20"),
      hk(9002, 10, 1, 1, 32, "Ketua Akhir", "T", "2026-06-20"),
      hk(9002, 10, 2, 2, 33, "Anggota", "T", "2026-06-01")
    );
    const peta = await majelis.penunjukanPerkaraBanyak([9001, 9002]);
    expect(peta.get("9001")!.tanggalPutusan).toBeNull();
    expect(ids(peta.get("9001")!.pemeriksa.hakim)).toEqual([22, 23, 24]);
    expect(ids(peta.get("9002")!.pemeriksa.hakim)).toEqual([32, 33]);
  });

  it("tanpa ikrar dan tanpa blangko: ikrar dan penetapanIkrar null, ikrarLengkap null", async () => {
    keadaan.hakim.push(hk(9003, 10, 1, 3, 40, "Hakim Tunggal Saja", "Y", "2026-05-01"));
    keadaan.putusan.push({ perkaraId: 9003, putus: "2026-06-01" });
    const e = (await majelis.penunjukanPerkaraBanyak([9003])).get("9003")!;
    expect(kedudukan(e.pemeriksa.hakim)).toEqual(["Hakim Tunggal"]);
    expect(e.ikrar).toBeNull();
    expect(e.penetapanIkrar).toBeNull();
    expect(majelis.ikrarLengkap(e)).toBeNull();
  });

  it("verzet (tahapan 16) ikut pemeriksa, disebut tahapannya, dan anggotanya dinomori per tahapan", async () => {
    keadaan.hakim.push(
      hk(9321, 10, 1, 1, 29, "Akbar Ali", "Y", "2025-12-24"),
      hk(9321, 10, 2, 2, 26, "Himawan", "Y", "2025-12-24"),
      hk(9321, 16, 1, 1, 29, "Akbar Ali", "Y", "2026-01-13"),
      hk(9321, 16, 2, 2, 28, "Idris", "Y", "2026-01-13")
    );
    keadaan.putusan.push({ perkaraId: 9321, putus: "2025-12-24" });
    const e = (await majelis.penunjukanPerkaraBanyak([9321])).get("9321")!;
    expect(e.pemeriksa.hakim.map((x) => [x.tahapanId, x.kedudukan, x.hakimId])).toEqual([
      [10, "Hakim Ketua", 29],
      [10, "Hakim Anggota 1", 26],
      [16, "Hakim Ketua", 29],
      [16, "Hakim Anggota 1", 28],
    ]);
  });

  it("setiap id sah mendapat entri; id tidak sah dilewati; kuerinya berparameter, dipotong per 500", async () => {
    kasus385();
    const banyak = Array.from({ length: 1200 }, (_, i) => 20000 + i);
    const peta = await majelis.penunjukanPerkaraBanyak(["385", "abc", "0", "-3", "1.5", 385, ...banyak]);
    expect(peta.size).toBe(1201);
    expect([...peta.keys()][0]).toBe("385");
    expect(peta.has("abc")).toBe(false);
    expect(peta.get("20000")).toMatchObject({ tanggalPutusan: null, ikrar: null, penetapanIkrar: null });
    expect(peta.get("20000")!.pemeriksa).toEqual({ hakim: [], panitera: [], jurusita: [] });

    const kePenunjukan = kueri.filter((k) => /FROM perkara_(hakim_pn|panitera_pn|jurusita|putusan|ikrar_talak) \w+\s+WHERE \w+\.perkara_id IN/.test(k.sql.replace(/\s+/g, " ")));
    // 5 tabel x 3 potongan (500 + 500 + 201).
    expect(kePenunjukan).toHaveLength(15);
    expect(majelis.POTONGAN_IN).toBe(500);
    for (const k of kePenunjukan) {
      expect(k.params.length).toBeLessThanOrEqual(500);
      expect((k.sql.match(/\?/g) ?? []).length).toBe(k.params.length);
      // Id tidak pernah ditulis ke teks kueri.
      expect(k.sql).not.toMatch(/\b20000\b|\b385\b/);
      expect(k.sql.trim()).toMatch(/^SELECT\b/);
    }
  });
});

// ===========================================================================
// 2. BORANG IKRAR DAN ikrarLengkap
// ===========================================================================

describe("blangko penetapan ikrar talak dan ikrarLengkap", () => {
  it("385: hakim ikrar dari penunjukan tahapan 18; panitera dan juru sita dari blangko", async () => {
    kasus385();
    const e = (await majelis.penunjukanPerkaraBanyak([385])).get("385")!;
    expect(e.penetapanIkrar!.hakim.map((x) => [x.kedudukan, x.nama, x.hakimId])).toEqual([
      ["Hakim Ketua", "Ulfah, S.Ag., M.H.", 9],
      ["Hakim Anggota 1", "Amar Ma'ruf, S.Ag.", 1],
      ["Hakim Anggota 2", "Ruhana Faried", 6],
    ]);
    // Id panitera NULL di borang: nama tetap, id tidak ditebak dari ejaan.
    expect(e.penetapanIkrar!.panitera).toEqual([{ nama: "Imayanti, S.H.", paniteraId: null, tahapanId: 18, kode: "" }]);
    expect(e.penetapanIkrar!.jurusita[0]).toMatchObject({ nama: "Muh. Sam'an", jurusitaId: 2 });

    const l = majelis.ikrarLengkap(e)!;
    expect(l.hakim.map((x) => [x.hakimId, x.sumber])).toEqual([
      [9, "penunjukan"],
      [1, "penunjukan"],
      [6, "penunjukan"],
    ]);
    expect(l.panitera.map((x) => [x.nama, x.sumber])).toEqual([["Imayanti, S.H.", "penetapanIkrar"]]);
    expect(l.jurusita.map((x) => [x.jurusitaId, x.sumber])).toEqual([[2, "penetapanIkrar"]]);
  });

  it("2373: tanpa baris aktif tahapan 18, majelis ikrarnya dari blangko - hakim tunggal", async () => {
    kasus2373();
    const e = (await majelis.penunjukanPerkaraBanyak([2373])).get("2373")!;
    expect(e.ikrar).toBeNull();
    const l = majelis.ikrarLengkap(e)!;
    expect(l.hakim.map((x) => [x.kedudukan, x.hakimId, x.sumber])).toEqual([["Hakim Tunggal", 7, "penetapanIkrar"]]);
    expect(l.panitera.map((x) => [x.nama, x.paniteraId])).toEqual([["Siti Rabiyah", 11]]);
    expect(l.jurusita.map((x) => [x.nama, x.jurusitaId])).toEqual([["Fachrudin", 29]]);
  });

  it("blangko tanpa sebutan per orang: kedudukan tidak ditebak; jumlah id yang tidak cocok: id dibuang", async () => {
    keadaan.borang.push(
      {
        perkaraId: 412,
        majelisId: "5,1,6",
        majelisTeks: "Majelis Hakim : Naharuddin<br>Amar Ma'ruf<br>Ruhana Faried",
        paniteraId: 9,
        paniteraTeks: "Panitera Pengganti: Nurmiati",
        jurusitaId: null,
        jurusitaTeks: "",
      },
      {
        perkaraId: 413,
        majelisId: "5,1",
        majelisTeks: "Hakim Ketua: A</br>Hakim Anggota 1: B</br>Hakim Anggota 2: C",
        paniteraId: null,
        paniteraTeks: "",
        jurusitaId: null,
        jurusitaTeks: "",
      }
    );
    const peta = await majelis.penunjukanPerkaraBanyak([412, 413]);
    expect(peta.get("412")!.penetapanIkrar!.hakim.map((x) => [x.kedudukan, x.nama, x.hakimId])).toEqual([
      ["Hakim", "Naharuddin", 5],
      ["Hakim", "Amar Ma'ruf", 1],
      ["Hakim", "Ruhana Faried", 6],
    ]);
    expect(peta.get("412")!.penetapanIkrar!.jurusita).toEqual([]);
    expect(peta.get("412")!.penetapanIkrar!.panitera).toEqual([
      { nama: "Nurmiati", paniteraId: 9, tahapanId: 18, kode: "" },
    ]);
    expect(peta.get("413")!.penetapanIkrar!.hakim.map((x) => x.hakimId)).toEqual([null, null, null]);
  });

  it("panitera blangko berbaris dua dengan satu id: dua nama, id tidak ditempelkan ke salah satunya", async () => {
    keadaan.borang.push({
      perkaraId: 414,
      majelisId: "",
      majelisTeks: "",
      paniteraId: 9,
      paniteraTeks: "Panitera Pengganti: Nurmiati<br/>Panitera Pengganti: Unun",
      jurusitaId: null,
      jurusitaTeks: "",
    });
    const e = (await majelis.penunjukanPerkaraBanyak([414])).get("414")!;
    expect(e.penetapanIkrar!.panitera.map((x) => [x.nama, x.paniteraId])).toEqual([
      ["Nurmiati", null],
      ["Unun", null],
    ]);
  });

  it("SIPP tanpa tabel perkara_ikrar_talak: blangko tidak dibaca, pemeriksa tetap terbaca", async () => {
    kasus385();
    keadaan.kolomBorang = [];
    const e = (await majelis.penunjukanPerkaraBanyak([385])).get("385")!;
    expect(ids(e.pemeriksa.hakim)).toEqual([4, 1, 6]);
    expect(e.penetapanIkrar).toBeNull();
    expect(kueri.some((k) => /perkara_ikrar_talak t/.test(k.sql))).toBe(false);
  });
});

// ===========================================================================
// 3. MUATAN STATUS PERKARA - statusLengkap UTUH
// ===========================================================================

const NOMOR_385 = "385/Pdt.G/2016/PA.Dgl";

function perkaraBaris(perkaraId: number, nomor: string): Baris {
  return {
    perkara_id: perkaraId,
    nomor_perkara: nomor,
    jenis_perkara_nama: "Cerai Talak",
    jenis_perkara_text: "Cerai Talak",
    alur_perkara_id: 15,
    jenis_perkara_id: 346,
    tanggal_pendaftaran: "2016-01-04",
  };
}

describe("statusLengkap: majelis pemeriksa dan majelis ikrar talak", () => {
  it("385: majelis perkara = pemeriksa (Arasy Latif), bukan majelis ikrar yang aktif (Ulfah)", async () => {
    kasus385();
    keadaan.perkara = perkaraBaris(385, NOMOR_385);
    const s = await layananStatus.statusLengkap(NOMOR_385);
    expect(s.ok).toBe(true);
    expect(s.sumberMajelis).toBe("pemeriksa");
    expect(s.majelis.map((x: Baris) => [x.id, x.nama, x.jabatan, x.kode])).toEqual([
      [4, "Arasy Latif", "Hakim Ketua", "H4"],
      [1, "Amar Ma'ruf", "Hakim Anggota 1", "H1"],
      [6, "Ruhana Faried", "Hakim Anggota 2", "H6"],
    ]);
    expect(s.panitera.map((x: Baris) => [x.id, x.nama])).toEqual([[4, "Imayanti, S.H."]]);
    expect(s.jurusita.map((x: Baris) => [x.id, x.nama])).toEqual([[2, "Muh. Sam'an"]]);

    expect(s.ikrar.majelis.map((x: Baris) => [x.id, x.jabatan, x.sumber])).toEqual([
      [9, "Hakim Ketua", "penunjukan"],
      [1, "Hakim Anggota 1", "penunjukan"],
      [6, "Hakim Anggota 2", "penunjukan"],
    ]);
    expect(s.ikrar.panitera.map((x: Baris) => [x.id, x.nama, x.sumber])).toEqual([[null, "Imayanti, S.H.", "penetapanIkrar"]]);
    expect(s.ikrar.jurusita.map((x: Baris) => [x.id, x.sumber])).toEqual([[2, "penetapanIkrar"]]);

    // Rubrik membaca daftar yang SAMA dengan layar.
    const rinci = (s.penilaian?.rinci ?? []).find((x: Baris) => x.kunci === "majelisDitetapkan");
    expect(rinci).toMatchObject({ bagian: 1, catatan: "Majelis dan panitera sudah ditetapkan." });
  });

  it("data lama yang seluruh penunjukannya T (perkara_id 1): majelis tetap terbaca, bukan 'belum ditetapkan'", async () => {
    keadaan.hakim.push(
      hk(1, 10, 1, 1, 2, "Ketua Diganti", "T", "2015-01-05", "2015-05-13"),
      hk(1, 10, 1, 1, 5, "Naharuddin", "T", "2015-05-13"),
      hk(1, 10, 2, 2, 1, "Amar Ma'ruf", "T", "2015-01-05", "2015-05-13"),
      hk(1, 10, 2, 2, 1, "Amar Ma'ruf", "T", "2015-05-13"),
      hk(1, 10, 3, 2, 7, "Rustam", "T", "2015-05-13")
    );
    keadaan.panitera.push(pt(1, 10, 8, "Normadia", "T", "2015-01-05"));
    keadaan.putusan.push({ perkaraId: 1, putus: "2015-05-13" });
    keadaan.borang.push({
      perkaraId: 1,
      majelisId: "5,1,7",
      majelisTeks: "Hakim Ketua: Naharuddin</br>Hakim Anggota 1: Amar Ma'ruf</br>Hakim Anggota 2: Rustam",
      paniteraId: 8,
      paniteraTeks: "Panitera Pengganti: Normadia",
      jurusitaId: 1,
      jurusitaTeks: "Jurusita: Fikrianto",
    });
    keadaan.perkara = perkaraBaris(1, "1/Pdt.G/2015/PA.Dgl");
    const s = await layananStatus.statusLengkap("1/Pdt.G/2015/PA.Dgl");
    expect(s.majelis.map((x: Baris) => x.id)).toEqual([5, 1, 7]);
    expect(s.panitera.map((x: Baris) => x.id)).toEqual([8]);
    // Dulu: penunjukan aktif kosong - rubrik dan layar menulis "Majelis belum ditetapkan".
    expect((s.penilaian?.rinci ?? []).find((x: Baris) => x.kunci === "majelisDitetapkan")).toMatchObject({
      bagian: 1,
      catatan: "Majelis dan panitera sudah ditetapkan.",
    });
    expect(s.ikrar.majelis.map((x: Baris) => [x.id, x.sumber])).toEqual([
      [5, "penetapanIkrar"],
      [1, "penetapanIkrar"],
      [7, "penetapanIkrar"],
    ]);
    expect(s.ikrar.panitera.map((x: Baris) => [x.id, x.nama])).toEqual([[8, "Normadia"]]);
  });

  it("perkara tanpa ikrar: ikrar null", async () => {
    kasus703();
    keadaan.perkara = perkaraBaris(703, "703/Pdt.G/2016/PA.Dgl");
    const s = await layananStatus.statusLengkap("703/Pdt.G/2016/PA.Dgl");
    expect(s.majelis.map((x: Baris) => x.id)).toEqual([8, 9, 7]);
    expect(s.ikrar).toBeNull();
  });

  it("modul pemeriksa gagal dibaca: jatuh ke penunjukan aktif Jadwal Sidang, dan itu DISEBUT", async () => {
    kasus385();
    keadaan.perkara = perkaraBaris(385, NOMOR_385);
    keadaan.gagal = /FROM perkara_hakim_pn h WHERE h\.perkara_id IN/;
    const s = await layananStatus.statusLengkap(NOMOR_385);
    expect(s.ok).toBe(true);
    expect(s.sumberMajelis).toBe("aktif");
    expect(s.ikrar).toBeNull();
    // Yang aktif di SIPP: majelis ikrar - dan layar diberi tahu itu bukan pemeriksa.
    expect(s.majelis.map((x: Baris) => x.nama)).toEqual(["Ulfah", "Amar Ma'ruf", "Ruhana Faried"]);
  });

  it("penunjukan tidak terbaca sama sekali: 'tidakTerbaca', bukan majelis kosong yang terbaca 'belum ditetapkan'", async () => {
    kasus385();
    keadaan.perkara = perkaraBaris(385, NOMOR_385);
    // Modul bersama DAN jalur Jadwal Sidang (rincianSidang) sama-sama gagal.
    keadaan.gagal = /FROM perkara_hakim_pn h WHERE h\.perkara_id IN|p\.jenis_perkara_nama AS jenisPerkara FROM perkara p/;
    const s = await layananStatus.statusLengkap(NOMOR_385);
    expect(s.ok).toBe(true);
    expect(s.sumberMajelis).toBe("tidakTerbaca");
    expect(s.majelis).toEqual([]);
    expect(s.ikrar).toBeNull();
  });
});

// ===========================================================================
// 4. RINGKASAN SALIN ATAS MUATAN ITU
// ===========================================================================

describe("ringkasan salin menyebut majelis pemeriksa dan majelis ikrar talak", () => {
  const HARI_INI = "2026-09-27";
  const susun = (bahan: BahanRingkasanSalin) =>
    susunRingkasanSalin(bahan, ringkasStatus(bahan as unknown as BahanRingkas, HARI_INI), { hariIni: HARI_INI });
  /** Bahan kurus (tanpa umur/jadwal) - ringkasan layarnya diberikan, seperti uji ringkasan-salin. */
  const susunKurus = (bahan: BahanRingkasanSalin) =>
    susunRingkasanSalin(bahan, { keadaan: "Dalam persidangan", peringatan: [] }, { hariIni: HARI_INI });

  it("muatan statusLengkap 385 disalin: dua kelompok, pemeriksa lebih dulu", async () => {
    kasus385();
    keadaan.perkara = perkaraBaris(385, NOMOR_385);
    const s = await layananStatus.statusLengkap(NOMOR_385);
    const teks = susun(s as BahanRingkasanSalin);
    const b = teks.split("\n");
    const iPemeriksa = b.indexOf("MAJELIS PEMERIKSA DAN PETUGAS");
    const iIkrar = b.indexOf("MAJELIS IKRAR TALAK");
    expect(iPemeriksa).toBeGreaterThan(-1);
    expect(iIkrar).toBeGreaterThan(iPemeriksa);
    expect(b.slice(iPemeriksa + 1, iPemeriksa + 6)).toEqual([
      "Hakim Ketua: Arasy Latif",
      "Hakim Anggota 1: Amar Ma'ruf",
      "Hakim Anggota 2: Ruhana Faried",
      "Panitera Pengganti: Imayanti, S.H.",
      "Jurusita: Muh. Sam'an",
    ]);
    expect(b.slice(iIkrar + 1, iIkrar + 6)).toEqual([
      "Hakim Ketua: Ulfah",
      "Hakim Anggota 1: Amar Ma'ruf",
      "Hakim Anggota 2: Ruhana Faried",
      "Panitera Sidang: Imayanti, S.H.",
      "Jurusita: Muh. Sam'an",
    ]);
    // Ketua ikrar tidak pernah disebut ketua majelis perkara.
    expect(b.slice(iPemeriksa, iIkrar).join("\n")).not.toContain("Ulfah");
  });

  it("muatan bot lama (tanpa sumberMajelis dan ikrar): judul lama, tanpa klaim 'pemeriksa'", () => {
    const teks = susunKurus({
      identitas: { nomorPerkara: "12/Pdt.G/2026/PA.Dgl" },
      majelis: [{ nama: "Hakim Aktif", jabatan: "Hakim Ketua" }],
      panitera: [{ nama: "Panitera Aktif" }],
    });
    expect(teks).toContain("MAJELIS DAN PETUGAS\nHakim Ketua: Hakim Aktif\nPanitera Pengganti: Panitera Aktif");
    expect(teks).not.toContain("PEMERIKSA");
    expect(teks).not.toContain("MAJELIS IKRAR TALAK");
  });

  it("kartu ringkas: majelis tak terbaca tidak dituduh 'belum ditetapkan'; bot lama tetap seperti dulu", async () => {
    kasus385();
    keadaan.perkara = perkaraBaris(385, NOMOR_385);
    keadaan.gagal = /FROM perkara_hakim_pn h WHERE h\.perkara_id IN|p\.jenis_perkara_nama AS jenisPerkara FROM perkara p/;
    const s = await layananStatus.statusLengkap(NOMOR_385);
    const r = ringkasStatus(s as BahanRingkas, HARI_INI);
    expect(r.majelisKalimat).toBe("Majelis tidak terbaca");
    expect(r.peringatan.some((p) => /Majelis hakim belum ditetapkan/.test(p.pesan))).toBe(false);

    // Muatan tanpa sumberMajelis (bot lama) dan majelis kosong: peringatan lama tetap.
    const lama = ringkasStatus({ ...(s as BahanRingkas), sumberMajelis: undefined }, HARI_INI);
    expect(lama.majelisKalimat).toBe("Majelis belum ditetapkan");
    expect(lama.peringatan.some((p) => /Majelis hakim belum ditetapkan/.test(p.pesan))).toBe(true);
  });

  it("penunjukan di luar pemeriksaan disebut tahapannya", () => {
    const teks = susunKurus({
      identitas: { nomorPerkara: "715/Pdt.G/2025/PA.Dgl" },
      sumberMajelis: "pemeriksa",
      majelis: [
        { nama: "Akbar Ali", jabatan: "Hakim Ketua" },
        { nama: "Akbar Ali", jabatan: "Hakim Ketua", keteranganTahapan: "verzet" },
      ],
      ikrar: null,
    });
    expect(teks).toContain("Hakim Ketua: Akbar Ali\nHakim Ketua: Akbar Ali (verzet)");
    expect(teks).not.toContain("MAJELIS IKRAR TALAK");
  });
});
