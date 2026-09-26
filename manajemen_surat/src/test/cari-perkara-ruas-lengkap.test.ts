// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * PENCARIAN STATUS PERKARA - RUAS RINCI, HALAMAN, DAN KATA BEBAS YANG DIPERLUAS
 * ============================================================================
 *
 * Diminta pengguna 25 September 2026:
 *
 *   7. hasil pencarian dapat dilihat sebagai kotak, daftar, dan rinci - yang
 *      rinci "lebih lengkap tampilannya"
 *   8. "buat pencarian di status perkara lebih lengkap lagi carinya"
 *
 * Berkas ini menjaga SISI BOT-nya: sippStatusPerkaraService.cariPerkaraHalaman
 * DIJALANKAN atas sipp_donggala setempat dengan db_config dijembatani
 * mysql.exe, lalu tiap jawabannya diadu dengan SQL TERPISAH yang ditulis ulang
 * di sini dengan bentuk berbeda (subkueri berkorelasi dan GROUP_CONCAT, bukan
 * kueri per tabel atas daftar id). Tidak ada satu pun pemeriksaan yang membaca
 * teks sumber - penjaga penyisir teks di repositori ini sudah tiga kali hijau
 * atas kode yang melempar galat.
 *
 * ============================================================================
 * YANG DIJAGA, DAN APA YANG RUSAK BILA PENJAGANYA HILANG
 * ============================================================================
 *
 * 1. RUAS RINCI PADA 30 PERKARA PILIHAN - belum putus, verstek, ghaib,
 *    e-Court, cerai talak berakta, tanpa penunjukan, berkuasa, permohonan,
 *    panitera ganda, sesudah ikrar talak, dan bersidang tepat pada "hari ini".
 *    Pihak yang tertukar (pihak kedua ditaruh di pihak pertama - sudah dua
 *    kali terjadi di ALETA), sidang hari ini yang terhitung "terakhir", umur
 *    yang tidak berhenti di tanggal putus: semuanya lolos dari uji penadah
 *    tetapi tidak dari sini.
 *
 * 2. HALAMAN - lewati/batas/adaLagi atas register sungguhan: halaman yang
 *    disambung harus SAMA PERSIS dengan daftar SQL terurut, tanpa baris
 *    ganda dan tanpa yang terlewat; pagu 500 berlaku.
 *
 * 3. KATA BEBAS YANG DIPERLUAS - nomor akta cerai, nomor banding, NIK,
 *    telepon, nama kuasa, agenda sidang. Himpunannya dibandingkan dengan SQL
 *    terpisah, dan keterangan "cocok"-nya harus menyebut medannya.
 *
 * 4. RUTE PORTAL - handler GET dijalankan dengan HANYA kewenangan dipalsukan.
 *    Jalur ke bot diadu dua kali: dengan fetch yang dicatat (selalu), dan
 *    dengan bot yang sungguh hidup (ALETA_UJI_BOT_HIDUP=1).
 *
 * Bila mysql.exe tidak ada di mesin ini, bagian basis datanya DILEWATI beserta
 * sebabnya. Query yang GAGAL tidak pernah dilewati: ia dilempar apa adanya.
 */

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  // HANYA kewenangan yang dipalsukan - sisanya sungguhan.
  pastikanKapabilitas: async () => ({ name: "Penguji" }),
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  // Galat yang ditelan menjadi 500 membuat uji gagal tanpa menyebut sebabnya.
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));

const require_ = createRequire(import.meta.url);
const AKAR = path.resolve(process.cwd(), "..");
const AKAR_BOT = path.join(AKAR, "aleta_bot");
const MYSQL = "D:/Satker Asal/Website PA Bungku/xampp/mysql/bin/mysql.exe";
const BASIS = "sipp_donggala";
// Berkas sementara ke D: - disk C: tidak disentuh.
const KERJA = "D:/aleta-dev/kerja/status-tampilan/uji";
const BERKAS_SQL = path.join(KERJA, "_uji-ruas-lengkap.sql");

const ADA_MYSQL = existsSync(MYSQL);

type Cocok = { medan: string; nilai: string };
type Baris = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  tanggalDaftar: string;
  sudahPutus: boolean;
  tanggalPutusan: string;
  alurPerkaraId: number;
  jenisPerkaraId: number;
  pihak1: string;
  pihak2: string;
  sebutanPihak1: string;
  sebutanPihak2: string;
  kuasa: string;
  hakimKetua: string;
  paniteraPengganti: string;
  jurusita: string;
  tahapan: string;
  proses: string;
  jumlahSidang: number;
  sidangTerakhir: string;
  sidangBerikut: string;
  umurHari: number | null;
  ecourt: boolean | null;
  nomorAktaCerai: string;
  tanggalAktaCerai: string;
  cocok: Cocok[];
};
type Halaman = {
  perkara: Baris[];
  adaLagi: boolean;
  lewati: number;
  batas: number;
  lapis: string;
  ruasTakTerbaca: string[];
};
type Layanan = {
  cariPerkaraHalaman: (kata: string, pilihan?: Record<string, unknown>) => Promise<Halaman>;
  TABEL_PIHAK: string[];
  PAGU_BARIS: number;
  KODE_PENCARIAN_HABIS_WAKTU: string;
  pesanGalatPencarian: (galat: unknown) => string;
};
type ModulCjs = new (id: string) => { filename: string; loaded: boolean; exports: unknown };
type BarisSql = Record<string, string | null>;

/** Mengubah isian `?` menjadi nilai SQL. */
function kutip(nilai: unknown): string {
  if (nilai === null || nilai === undefined) return "NULL";
  if (Array.isArray(nilai)) return nilai.length === 0 ? "NULL" : nilai.map(kutip).join(",");
  if (typeof nilai === "number") return String(nilai);
  if (nilai instanceof Date) return `'${nilai.toISOString().slice(0, 19).replace("T", " ")}'`;
  return `'${String(nilai).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

/**
 * Menjalankan SQL lewat mysql.exe. Awalan `SET ...;` boleh ikut - keluarannya
 * kosong, jadi yang terbaca hanya hasil SELECT terakhir.
 */
function jalankanSql(sql: string, isian: unknown[] = []): BarisSql[] {
  let i = 0;
  const utuh = sql.replace(/\?/g, () => kutip(isian[i++]));
  mkdirSync(KERJA, { recursive: true });
  writeFileSync(BERKAS_SQL, utuh, "utf8");
  const keluar = execFileSync(MYSQL, ["-u", "root", "-B", BASIS, `--execute=source ${BERKAS_SQL}`], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  }).trim();
  if (!keluar) return [];
  const baris = keluar.split(/\r?\n/);
  const kepala = baris[0].split("\t");
  return baris.slice(1).map((b) => {
    const sel = b.split("\t");
    const o: BarisSql = {};
    kepala.forEach((k, j) => (o[k] = sel[j] === "NULL" ? null : sel[j]));
    return o;
  });
}

/**
 * Kueri yang dikirim layanan lewat jembatan, berurutan. Dipakai uji yang
 * perlu menanyakan RENCANA kueri yang sungguh dikirim (EXPLAIN), bukan
 * salinan teksnya.
 */
const kueriTerkirim: Array<{ sql: string; isian: unknown[] }> = [];

/**
 * Galat yang disuntikkan jembatan untuk kueri tertentu - dipakai uji habis
 * waktu: galatnya berbentuk PERSIS galat driver mysql yang terukur pada bot
 * hidup ("Query inactivity timeout", PROTOCOL_SEQUENCE_TIMEOUT). null = tidak
 * ada suntikan; kuerinya dijalankan sungguhan.
 */
let suntikGalat: ((sql: string) => Error | null) | null = null;

/**
 * Memuat layanan bot dengan db_config DIGANTI jembatan mysql.exe.
 *
 * Penggantinya dipasang di require.cache SEBELUM layanannya dimuat, supaya
 * kolam sambungan mysql yang sungguhan tidak pernah dibuat.
 */
function muatLayanan(): Layanan {
  const jalurDb = require_.resolve(path.join(AKAR_BOT, "db_config"));
  const Modul = require_("node:module") as unknown as ModulCjs;
  const palsu = new Modul(jalurDb);
  palsu.filename = jalurDb;
  palsu.loaded = true;
  palsu.exports = {
    query: (sql: string, isian: unknown[], balik: (galat: Error | null, hasil: unknown) => void) => {
      kueriTerkirim.push({ sql: String(sql), isian: Array.isArray(isian) ? isian.slice() : [] });
      const suntikan = suntikGalat ? suntikGalat(String(sql)) : null;
      if (suntikan) {
        balik(suntikan, null);
        return;
      }
      try {
        balik(null, jalankanSql(sql, isian || []));
      } catch (e) {
        // Galat SQL diteruskan APA ADANYA. Mengubahnya menjadi larik kosong akan
        // membuat uji ini hijau atas layanan yang tidak dapat membaca apa pun.
        const galat = e as { stderr?: string; message?: string };
        const pesan = String(galat.stderr || galat.message || e)
          .split(/\r?\n/)[0]
          .slice(0, 400);
        balik(new Error(pesan), null);
      }
    },
  };
  const cache = require_.cache as unknown as Record<string, unknown>;
  cache[jalurDb] = palsu;
  return require_(path.join(AKAR_BOT, "services", "sippStatusPerkaraService.js")) as Layanan;
}

const layanan = muatLayanan();

/** Spasi dirapatkan - cleanText di bot melakukan hal yang sama. */
const rapat = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const id = (daftar: Array<{ perkaraId: string }>) => daftar.map((x) => String(x.perkaraId));
const kolom = (baris: BarisSql[], k: string) => baris.map((x) => String(x[k]));
const daftarIn = (ids: string[]) => ids.map((x) => Number(x)).join(",");

/** Urutan hasil yang dijanjikan: tanggal daftar terbaru dulu, lalu id terbesar. */
function urutRegister(ids: string[]): string[] {
  if (ids.length === 0) return [];
  return kolom(
    jalankanSql(
      `SELECT p.perkara_id FROM perkara p WHERE p.perkara_id IN (${daftarIn(ids)})
        ORDER BY p.tanggal_pendaftaran DESC, p.perkara_id DESC`
    ),
    "perkara_id"
  );
}

// ===========================================================================
// 1. RUAS RINCI PADA 30 PERKARA PILIHAN
// ===========================================================================

/**
 * "Hari ini" untuk uji dipilih dari data: hari bersidang terdekat sesudah
 * 25 September 2026 (hari uji ditulis), supaya ada perkara yang sidangnya
 * TEPAT pada hari itu - hanya itulah yang dapat membedakan `<` dari `<=`.
 */
let HARI_INI = "";
let sampel: string[] = [];
let halamanSampel: Halaman | null = null;
const alasanSampel = new Map<string, string>();

beforeAll(() => {
  if (!ADA_MYSQL) return;
  const hari = jalankanSql(
    `SELECT DATE_FORMAT(j.tanggal_sidang, '%Y-%m-%d') AS hari
       FROM perkara_jadwal_sidang j
      WHERE j.tanggal_sidang > '2026-09-25'
      GROUP BY j.tanggal_sidang
      ORDER BY COUNT(DISTINCT j.perkara_id) DESC, j.tanggal_sidang ASC
      LIMIT 1`
  );
  HARI_INI = hari[0]?.hari || "2026-09-29";

  const acak = "CRC32(CONCAT('ruas-lengkap-', p.perkara_id))";
  const golongan: Array<[string, number, string]> = [
    ["belum putus", 4, "NOT EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.tanggal_putusan IS NOT NULL)"],
    ["verstek", 3, "EXISTS (SELECT 1 FROM perkara_putusan pu WHERE pu.perkara_id = p.perkara_id AND pu.putusan_verstek = 'Y')"],
    ["ghaib", 3, "EXISTS (SELECT 1 FROM perkara_pelaksanaan_relaas r WHERE r.perkara_id = p.perkara_id AND r.ket_temu IN ('R','M','W','P'))"],
    ["e-Court", 3, "EXISTS (SELECT 1 FROM perkara_efiling_id k WHERE k.perkara_id = p.perkara_id)"],
    ["cerai talak berakta", 3, "p.jenis_perkara_id = 346 AND EXISTS (SELECT 1 FROM perkara_akta_cerai ac WHERE ac.perkara_id = p.perkara_id AND ac.nomor_akta_cerai <> '')"],
    ["tanpa penunjukan", 3, "NOT EXISTS (SELECT 1 FROM perkara_hakim_pn h WHERE h.perkara_id = p.perkara_id AND h.aktif = 'Y')"],
    ["berkuasa", 3, "EXISTS (SELECT 1 FROM perkara_pengacara k WHERE k.perkara_id = p.perkara_id AND k.aktif = 'Y')"],
    ["permohonan", 2, "p.alur_perkara_id = 16"],
    ["panitera ganda", 2, "(SELECT COUNT(DISTINCT x.panitera_nama) FROM perkara_panitera_pn x WHERE x.perkara_id = p.perkara_id AND x.aktif = 'Y') > 1"],
    ["sesudah ikrar talak", 2, "EXISTS (SELECT 1 FROM perkara_hakim_pn h WHERE h.perkara_id = p.perkara_id AND h.aktif = 'Y' AND h.tahapan_id = 18)"],
    ["sidang tepat hari ini", 2, `EXISTS (SELECT 1 FROM perkara_jadwal_sidang j WHERE j.perkara_id = p.perkara_id AND j.tanggal_sidang = '${HARI_INI}')`],
  ];
  const terpilih: string[] = [];
  for (const [nama, jumlah, syarat] of golongan) {
    const kecuali = terpilih.length ? `AND p.perkara_id NOT IN (${daftarIn(terpilih)})` : "";
    const baris = jalankanSql(
      `SELECT p.perkara_id FROM perkara p WHERE ${syarat} ${kecuali} ORDER BY ${acak} LIMIT ${jumlah}`
    );
    for (const b of baris) {
      terpilih.push(String(b.perkara_id));
      alasanSampel.set(String(b.perkara_id), nama);
    }
  }
  sampel = terpilih;
}, 300_000);

/** Nilai yang diharapkan, dihitung SQL terpisah - bentuknya sengaja lain. */
function harapanRuas(ids: string[], hariIni: string) {
  const isian = daftarIn(ids);
  const pokok = jalankanSql(
    `SET SESSION group_concat_max_len = 1000000;
     SELECT p.perkara_id,
            p.alur_perkara_id AS alur,
            p.jenis_perkara_id AS jenis,
            p.tahapan_terakhir_text AS tahapan,
            p.proses_terakhir_text AS proses,
            (SELECT GROUP_CONCAT(NULLIF(TRIM(a.nama), '') ORDER BY a.urutan, a.id SEPARATOR '; ')
               FROM perkara_pihak1 a WHERE a.perkara_id = p.perkara_id) AS pihak1,
            (SELECT GROUP_CONCAT(NULLIF(TRIM(b.nama), '') ORDER BY b.urutan, b.id SEPARATOR '; ')
               FROM perkara_pihak2 b WHERE b.perkara_id = p.perkara_id) AS pihak2,
            CASE WHEN p.alur_perkara_id IN (122, 123) THEN 'Penuntut Umum'
                 WHEN p.alur_perkara_id = 16 OR p.jenis_perkara_id IN (346, 341) THEN 'Pemohon'
                 ELSE 'Penggugat' END AS sebutan1,
            CASE WHEN p.alur_perkara_id IN (122, 123) THEN 'Terdakwa'
                 WHEN p.alur_perkara_id = 16 OR p.jenis_perkara_id IN (346, 341) THEN 'Termohon'
                 ELSE 'Tergugat' END AS sebutan2,
            (SELECT h.hakim_nama FROM perkara_hakim_pn h
              WHERE h.perkara_id = p.perkara_id AND h.aktif = 'Y'
              ORDER BY CASE WHEN h.jabatan_hakim_id = 1 OR h.jabatan_hakim_id = 3 THEN 0 ELSE 1 END,
                       h.tahapan_id DESC, h.urutan, h.id
              LIMIT 1) AS ketua,
            (SELECT COUNT(*) FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = p.perkara_id AND j.tanggal_sidang < '${hariIni}') AS jumlah,
            (SELECT DATE_FORMAT(MAX(j.tanggal_sidang), '%Y-%m-%d') FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = p.perkara_id AND j.tanggal_sidang < '${hariIni}') AS terakhir,
            (SELECT DATE_FORMAT(MIN(j.tanggal_sidang), '%Y-%m-%d') FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = p.perkara_id AND j.tanggal_sidang >= '${hariIni}') AS berikut,
            DATEDIFF(COALESCE((SELECT MAX(pu.tanggal_putusan) FROM perkara_putusan pu
                                WHERE pu.perkara_id = p.perkara_id), '${hariIni}'),
                     p.tanggal_pendaftaran) AS umur,
            (SELECT COUNT(*) FROM perkara_efiling_id k WHERE k.perkara_id = p.perkara_id) > 0 AS ecourt,
            (SELECT ac.nomor_akta_cerai FROM perkara_akta_cerai ac WHERE ac.perkara_id = p.perkara_id) AS akta,
            (SELECT DATE_FORMAT(ac.tgl_akta_cerai, '%Y-%m-%d') FROM perkara_akta_cerai ac
              WHERE ac.perkara_id = p.perkara_id) AS tanggalAkta
       FROM perkara p
      WHERE p.perkara_id IN (${isian})`
  );

  // Daftar nama unik menurut kemunculan PERTAMA - dihitung dengan MIN atas
  // kunci urutan, bukan dengan menyusuri baris seperti di bot.
  const unik = (sql: string) => {
    const peta = new Map<string, string>();
    for (const b of jalankanSql(`SET SESSION group_concat_max_len = 1000000; ${sql}`)) {
      peta.set(String(b.perkara_id), String(b.daftar ?? ""));
    }
    return peta;
  };
  // Kuasa PER SISI (pihak_ke), satu orang (pengacara_id) sekali per sisi,
  // berurutan menurut kemunculan pertamanya. Sebutan sisinya dirangkai di
  // bawah dari CASE sebutan1/sebutan2 kueri pokok - bukan dari
  // sebutanPihakService yang dipakai bot.
  const kuasaSisi = new Map<string, string>();
  for (const b of jalankanSql(
    `SET SESSION group_concat_max_len = 1000000;
     SELECT z.perkara_id, z.pihak_ke, GROUP_CONCAT(z.nama ORDER BY z.posisi SEPARATOR '; ') AS daftar
       FROM (SELECT k.perkara_id, k.pihak_ke,
                    SUBSTRING_INDEX(GROUP_CONCAT(TRIM(k.nama) ORDER BY COALESCE(k.urutan, 0), k.id SEPARATOR '|~|'), '|~|', 1) AS nama,
                    MIN(COALESCE(k.urutan, 0) * 10000000 + k.id) AS posisi
               FROM perkara_pengacara k
              WHERE k.perkara_id IN (${isian}) AND k.aktif = 'Y' AND TRIM(k.nama) <> ''
              GROUP BY k.perkara_id, k.pihak_ke, k.pengacara_id) z
      GROUP BY z.perkara_id, z.pihak_ke`
  )) {
    kuasaSisi.set(`${b.perkara_id}|${b.pihak_ke}`, String(b.daftar ?? ""));
  }
  // Panitera dan juru sita: satu ORANG (panitera_id / jurusita_id) sekali,
  // dengan ejaan penunjukan tahapan terakhirnya.
  const panitera = unik(
    `SELECT z.perkara_id, GROUP_CONCAT(z.nama ORDER BY z.posisi SEPARATOR '; ') AS daftar
       FROM (SELECT x.perkara_id,
                    SUBSTRING_INDEX(GROUP_CONCAT(TRIM(x.panitera_nama)
                      ORDER BY x.tahapan_id DESC, COALESCE(x.urutan, 0), x.id SEPARATOR '|~|'), '|~|', 1) AS nama,
                    MIN((1000 - x.tahapan_id) * 1000000000000 + COALESCE(x.urutan, 0) * 10000000 + x.id) AS posisi
               FROM perkara_panitera_pn x
              WHERE x.perkara_id IN (${isian}) AND x.aktif = 'Y' AND TRIM(x.panitera_nama) <> ''
              GROUP BY x.perkara_id, x.panitera_id) z
      GROUP BY z.perkara_id`
  );
  const jurusita = unik(
    `SELECT z.perkara_id, GROUP_CONCAT(z.nama ORDER BY z.posisi SEPARATOR '; ') AS daftar
       FROM (SELECT x.perkara_id,
                    SUBSTRING_INDEX(GROUP_CONCAT(TRIM(x.jurusita_nama)
                      ORDER BY x.tahapan_id DESC, COALESCE(x.urutan, 0), x.id SEPARATOR '|~|'), '|~|', 1) AS nama,
                    MIN((1000 - x.tahapan_id) * 1000000000000 + COALESCE(x.urutan, 0) * 10000000 + x.id) AS posisi
               FROM perkara_jurusita x
              WHERE x.perkara_id IN (${isian}) AND x.aktif = 'Y' AND TRIM(x.jurusita_nama) <> ''
              GROUP BY x.perkara_id, x.jurusita_id) z
      GROUP BY z.perkara_id`
  );

  const harapan = new Map<string, Record<string, unknown>>();
  for (const b of pokok) {
    const k = String(b.perkara_id);
    const kuasa = [
      [1, b.sebutan1],
      [2, b.sebutan2],
    ]
      .map(([ke, sebutan]) => {
        const daftar = kuasaSisi.get(`${k}|${ke}`);
        return daftar ? `Kuasa ${sebutan}: ${daftar}` : "";
      })
      .filter(Boolean)
      .join("; ");
    harapan.set(k, {
      pihak1: rapat(b.pihak1),
      pihak2: rapat(b.pihak2),
      sebutanPihak1: b.sebutan1,
      sebutanPihak2: b.sebutan2,
      kuasa: rapat(kuasa),
      hakimKetua: rapat(b.ketua),
      paniteraPengganti: rapat(panitera.get(k)),
      jurusita: rapat(jurusita.get(k)),
      tahapan: rapat(b.tahapan),
      proses: rapat(b.proses),
      jumlahSidang: Number(b.jumlah),
      sidangTerakhir: b.terakhir ?? "",
      sidangBerikut: b.berikut ?? "",
      umurHari: b.umur === null ? null : Number(b.umur),
      ecourt: b.ecourt === "1",
      nomorAktaCerai: rapat(b.akta),
      tanggalAktaCerai: b.tanggalAkta ?? "",
      alurPerkaraId: Number(b.alur),
      jenisPerkaraId: Number(b.jenis),
    });
  }
  return harapan;
}

describe.skipIf(!ADA_MYSQL)("ruas rinci pada 30 perkara pilihan (sipp_donggala)", () => {
  it("sampelnya memuat seluruh golongan yang diminta", () => {
    expect(sampel.length).toBe(30);
    expect(new Set(sampel).size).toBe(30);
    expect(HARI_INI).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("setiap ruas sama dengan SQL terpisah - 30 perkara, 19 ruas", async () => {
    // idTag dipakai sebagai "cari persis perkara-perkara ini" - jalur yang
    // sama dengan tag panel, jadi yang diuji juga jalur yang dipakai layar.
    halamanSampel = await layanan.cariPerkaraHalaman("", { idTag: sampel, batas: 500, hariIni: HARI_INI });
    const h = halamanSampel;
    expect(h.ruasTakTerbaca).toEqual([]);
    expect(h.perkara.length).toBe(30);
    // Urutan hasil tidak berubah: tanggal daftar terbaru dulu.
    expect(id(h.perkara)).toEqual(urutRegister(sampel));

    const harapan = harapanRuas(sampel, HARI_INI);
    const selisih: string[] = [];
    for (const x of h.perkara) {
      const hr = harapan.get(x.perkaraId);
      if (!hr) {
        selisih.push(`${x.perkaraId}: tidak ada di SQL terpisah`);
        continue;
      }
      for (const [ruas, nilai] of Object.entries(hr)) {
        const aktual = (x as unknown as Record<string, unknown>)[ruas];
        if (aktual !== nilai) {
          selisih.push(
            `${x.nomorPerkara} [${alasanSampel.get(x.perkaraId)}] ${ruas}: bot=${JSON.stringify(aktual)} sql=${JSON.stringify(nilai)}`
          );
        }
      }
    }
    expect(selisih).toEqual([]);
  }, 300_000);

  it("golongan pilihan sungguh tercermin di ruasnya (bukan sampel yang seragam)", () => {
    const d = halamanSampel?.perkara ?? [];
    expect(d.length).toBe(30);
    expect(d.some((x) => !x.sudahPutus)).toBe(true);
    expect(d.some((x) => x.ecourt === true)).toBe(true);
    expect(d.some((x) => x.ecourt === false)).toBe(true);
    expect(d.some((x) => x.nomorAktaCerai !== "" && x.sebutanPihak1 === "Pemohon")).toBe(true);
    expect(d.some((x) => x.hakimKetua === "")).toBe(true);
    expect(d.some((x) => x.kuasa !== "")).toBe(true);
    expect(d.some((x) => x.paniteraPengganti.includes("; "))).toBe(true);
    expect(d.some((x) => x.sidangBerikut === HARI_INI)).toBe(true);
    expect(d.some((x) => x.alurPerkaraId === 16 && x.sebutanPihak2 === "Termohon")).toBe(true);
    // Belum putus: umurnya dihitung sampai "hari ini", jadi tidak pernah
    // kurang dari umur perkara yang sama menurut tanggal daftarnya.
    for (const x of d.filter((y) => !y.sudahPutus)) expect(x.umurHari).not.toBeNull();
  });
});

// ===========================================================================
// 2. HALAMAN: LEWATI, BATAS, ADALAGI
// ===========================================================================

describe.skipIf(!ADA_MYSQL)("halaman atas register sungguhan", () => {
  it("halaman-halaman yang disambung = daftar SQL terurut, tanpa ganda dan tanpa terlewat", async () => {
    const acuan = kolom(
      jalankanSql(
        `SELECT p.perkara_id FROM perkara p
          WHERE p.jenis_perkara_nama LIKE '%Cerai Talak%' AND YEAR(p.tanggal_pendaftaran) = 2024
          ORDER BY p.tanggal_pendaftaran DESC, p.perkara_id DESC`
      ),
      "perkara_id"
    );
    expect(acuan.length).toBeGreaterThan(80);

    const BATAS = 40;
    const kumpul: string[] = [];
    const adaLagi: boolean[] = [];
    for (let lewati = 0; lewati < acuan.length; lewati += BATAS) {
      const h = await layanan.cariPerkaraHalaman("", {
        jenisPerkara: "Cerai Talak",
        tahun: "2024",
        batas: BATAS,
        lewati,
      });
      expect(h.lewati).toBe(lewati);
      expect(h.batas).toBe(BATAS);
      kumpul.push(...id(h.perkara));
      adaLagi.push(h.adaLagi);
    }
    expect(kumpul).toEqual(acuan);
    // adaLagi benar pada tiap halaman kecuali yang terakhir.
    expect(adaLagi).toEqual(adaLagi.map((_, i) => i < adaLagi.length - 1));

    // Satu halaman melewati ujung: kosong, dan tidak ada lagi.
    const lewat = await layanan.cariPerkaraHalaman("", {
      jenisPerkara: "Cerai Talak",
      tahun: "2024",
      batas: BATAS,
      lewati: acuan.length,
    });
    expect(lewat.perkara).toEqual([]);
    expect(lewat.adaLagi).toBe(false);
  }, 300_000);

  it("halaman ditentukan dulu: pencarian di tabel turunan, putusan disambung hanya untuk baris halaman", async () => {
    // Bentuk lama menyambung ringkasan putusan pada TIAP baris yang disisir,
    // termasuk yang dilompati OFFSET - halaman kedua berisi 500 terukur 4,0
    // detik, bentuk ini 0,36 detik. Jawabannya wajib sama; rencananya yang
    // membuktikan bentuknya tidak kembali diam-diam.
    kueriTerkirim.length = 0;
    const h = await layanan.cariPerkaraHalaman("", { tahun: "2025", batas: 500, lewati: 500 });
    expect(h.ruasTakTerbaca).toEqual([]);
    const acuan = kolom(
      jalankanSql(
        `SELECT p.perkara_id FROM perkara p WHERE YEAR(p.tanggal_pendaftaran) = 2025
          ORDER BY p.tanggal_pendaftaran DESC, p.perkara_id DESC LIMIT 500 OFFSET 500`
      ),
      "perkara_id"
    );
    expect(acuan.length).toBeGreaterThan(0);
    expect(id(h.perkara)).toEqual(acuan);

    const utama = kueriTerkirim.find((q) => /FROM perkara p\b/.test(q.sql));
    expect(utama, "kueri utama tidak terkirim").toBeTruthy();
    const rencana = jalankanSql(`EXPLAIN ${utama?.sql ?? ""}`, utama?.isian ?? []);
    const cari = rencana.find((r) => r.table === "p");
    const sambung = rencana.find((r) => r.table === "pr");
    expect(cari?.select_type, JSON.stringify(rencana)).toBe("DERIVED");
    expect(sambung?.select_type, JSON.stringify(rencana)).toBe("PRIMARY");
    expect(sambung?.type, JSON.stringify(rencana)).toBe("eq_ref");
  }, 300_000);

  it("pagu 500: batas yang lebih besar dipagari, dan sisanya diakui lewat adaLagi", async () => {
    const jumlah = Number(
      jalankanSql("SELECT COUNT(*) AS n FROM perkara p WHERE YEAR(p.tanggal_pendaftaran) = 2025")[0].n
    );
    expect(jumlah).toBeGreaterThan(500);
    const h = await layanan.cariPerkaraHalaman("", { tahun: "2025", batas: 9999 });
    expect(layanan.PAGU_BARIS).toBe(500);
    expect(h.batas).toBe(500);
    expect(h.perkara.length).toBe(500);
    expect(h.adaLagi).toBe(true);
    expect(h.ruasTakTerbaca).toEqual([]);
    // Ruas rinci ikut terisi pada baris ke-500 juga, bukan hanya di awal.
    const akhir = h.perkara[499];
    expect(akhir.sebutanPihak1.length).toBeGreaterThan(0);
    expect(akhir.jenisPerkaraId).toBeGreaterThan(0);
    expect(akhir.pihak1.length).toBeGreaterThan(0);
  }, 300_000);
});

// ===========================================================================
// 3. KATA BEBAS YANG DIPERLUAS
// ===========================================================================

/**
 * Himpunan yang diharapkan untuk kata bergaris miring - SQL terpisah.
 *
 * BERTAHAP (telaah 26 September 2026): nomor perkara dulu; nomor lain - akta
 * cerai, banding, kasasi, PK, akta nikah - HANYA bila tidak satu pun nomor
 * perkara cocok. Digabung dalam satu himpunan, "/2019" memuat 338 perkara
 * bernomor lain di atas perkara 2019 (akta nikah "0074/006/IV/2019").
 */
function harapanNomor(kata: string, batas = 500): string[] {
  const suka = `%${kata}%`;
  const nomor = kolom(jalankanSql("SELECT perkara_id FROM perkara WHERE nomor_perkara LIKE ?", [suka]), "perkara_id");
  if (nomor.length > 0) return urutRegister(nomor).slice(0, batas);
  const ids = kolom(
    jalankanSql(
      `SELECT perkara_id FROM perkara_akta_cerai WHERE nomor_akta_cerai LIKE ?
       UNION SELECT perkara_id FROM perkara_banding WHERE nomor_perkara_banding LIKE ? OR nomor_putusan_banding LIKE ?
       UNION SELECT perkara_id FROM perkara_kasasi WHERE nomor_perkara_kasasi LIKE ? OR nomor_putusan_kasasi LIKE ?
       UNION SELECT perkara_id FROM perkara_pk WHERE nomor_perkara_pk LIKE ? OR nomor_putusan_pk LIKE ?
       UNION SELECT perkara_id FROM perkara_data_pernikahan WHERE no_kutipan_akta_nikah LIKE ?`,
      [suka, suka, suka, suka, suka, suka, suka, suka]
    ),
    "perkara_id"
  );
  return urutRegister(ids).slice(0, batas);
}

/** Medan "cocok" yang menyebut nomor LAIN (bukan nomor perkara). */
const MEDAN_NOMOR_LAIN = ["Akta cerai", "Nomor banding", "Nomor kasasi", "Nomor PK", "Akta nikah"];

/** Himpunan yang diharapkan untuk angka panjang (NIK/telepon/akta nikah). */
function harapanIdentitas(kata: string): string[] {
  const suka = `%${kata}%`;
  const cabang = layanan.TABEL_PIHAK.map(
    (t) =>
      `SELECT x.perkara_id FROM ${t} x JOIN pihak ip ON ip.id = x.pihak_id
        WHERE ip.nomor_indentitas LIKE ? OR ip.telepon LIKE ?`
  ).join(" UNION ");
  const isian: string[] = [];
  for (let i = 0; i < layanan.TABEL_PIHAK.length; i += 1) isian.push(suka, suka);
  const ids = kolom(
    jalankanSql(
      `${cabang} UNION SELECT perkara_id FROM perkara_data_pernikahan WHERE no_kutipan_akta_nikah LIKE ?`,
      [...isian, suka]
    ),
    "perkara_id"
  );
  return urutRegister(ids).slice(0, 500);
}

/** Himpunan lapis cepat untuk kata teks - nomor, jenis, 6 tabel pihak, kuasa. */
function harapanCepat(kata: string): string[] {
  const suka = `%${kata}%`;
  const pihak = layanan.TABEL_PIHAK.map((t) => `SELECT perkara_id FROM ${t} WHERE nama LIKE ?`).join(" UNION ");
  const ids = kolom(
    jalankanSql(
      `SELECT perkara_id FROM perkara WHERE nomor_perkara LIKE ? OR jenis_perkara_nama LIKE ?
       UNION ${pihak}
       UNION SELECT perkara_id FROM perkara_pengacara WHERE nama LIKE ?`,
      [suka, suka, ...layanan.TABEL_PIHAK.map(() => suka), suka]
    ),
    "perkara_id"
  );
  return urutRegister(ids).slice(0, 500);
}

describe.skipIf(!ADA_MYSQL)("kata bebas yang diperluas - atas data sungguhan", () => {
  it("tabel pihak yang disisir = tabel yang dihimpun v_pihak_perkara (definisinya dibaca dari SIPP)", () => {
    // Layanan meninggalkan v_pihak_perkara (8-20 detik per kueri) dan
    // menyisir tabel-tabel pihaknya langsung. Itu hanya setara bila daftarnya
    // SAMA dengan yang dihimpun view - satu tabel terlewat berarti perkara
    // yang dulu ketemu hilang tanpa galat. Definisinya dibaca dari SIPP, jadi
    // SIPP versi lain yang menambah tabel pihak langsung memerahkan ini.
    const [view] = jalankanSql(
      `SELECT VIEW_DEFINITION AS definisi FROM information_schema.VIEWS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'v_pihak_perkara'`
    );
    expect(view?.definisi, "v_pihak_perkara tidak ada di salinan ini").toBeTruthy();
    const dihimpun = [
      ...new Set([...String(view.definisi).matchAll(/`(perkara_pihak[a-z0-9_]*)`/g)].map((m) => m[1])),
    ].sort();
    expect(dihimpun.length).toBeGreaterThanOrEqual(2);
    expect([...layanan.TABEL_PIHAK].sort()).toEqual(dihimpun);
  });

  it("nomor akta cerai: ketemu, dijelaskan, dan himpunannya sama dengan SQL terpisah", async () => {
    const [contoh] = jalankanSql(
      `SELECT perkara_id, nomor_akta_cerai FROM perkara_akta_cerai
        WHERE nomor_akta_cerai LIKE '%/AC/%' ORDER BY CRC32(CONCAT('akta-', perkara_id)) LIMIT 1`
    );
    const nomor = String(contoh.nomor_akta_cerai);
    const h = await layanan.cariPerkaraHalaman(nomor, { batas: 500 });
    expect(id(h.perkara)).toEqual(harapanNomor(nomor));
    const baris = h.perkara.find((x) => x.perkaraId === String(contoh.perkara_id));
    expect(baris, `perkara ${contoh.perkara_id} berakta ${nomor} tidak ketemu`).toBeTruthy();
    expect(baris?.cocok).toContainEqual({ medan: "Akta cerai", nilai: rapat(nomor) });
    expect(baris?.nomorAktaCerai).toBe(rapat(nomor));
  }, 300_000);

  it("nomor perkara banding: ketemu dan dijelaskan", async () => {
    const [contoh] = jalankanSql(
      `SELECT perkara_id, nomor_perkara_banding FROM perkara_banding
        WHERE nomor_perkara_banding <> '' ORDER BY perkara_id LIMIT 1`
    );
    const nomor = String(contoh.nomor_perkara_banding);
    const h = await layanan.cariPerkaraHalaman(nomor, { batas: 500 });
    expect(id(h.perkara)).toEqual(harapanNomor(nomor));
    const baris = h.perkara.find((x) => x.perkaraId === String(contoh.perkara_id));
    expect(baris?.cocok).toContainEqual({ medan: "Nomor banding", nilai: rapat(nomor) });
  }, 300_000);

  it("NIK 16 digit: bukan lagi nomor urut - perkara pihaknya ketemu dan dijelaskan", async () => {
    const [contoh] = jalankanSql(
      `SELECT ip.nomor_indentitas AS nik, COUNT(DISTINCT x.perkara_id) AS n
         FROM pihak ip JOIN perkara_pihak1 x ON x.pihak_id = ip.id
        WHERE LENGTH(ip.nomor_indentitas) = 16
        GROUP BY ip.nomor_indentitas HAVING n >= 2
        ORDER BY n DESC, ip.nomor_indentitas LIMIT 1`
    );
    const nik = String(contoh.nik);
    const h = await layanan.cariPerkaraHalaman(nik, { batas: 500 });
    const harap = harapanIdentitas(nik);
    expect(harap.length).toBeGreaterThanOrEqual(2);
    expect(id(h.perkara)).toEqual(harap);
    for (const x of h.perkara) {
      const nikCocok = x.cocok.find((c) => c.medan === "Nomor identitas");
      const aktaCocok = x.cocok.find((c) => c.medan === "Akta nikah");
      // Tiap perkara menjelaskan mengapa ia muncul - lewat NIK atau akta nikah.
      expect(Boolean(nikCocok) || Boolean(aktaCocok), `${x.nomorPerkara} tanpa keterangan`).toBe(true);
      if (nikCocok) expect(nikCocok.nilai.startsWith(nik)).toBe(true);
    }
  }, 300_000);

  it("telepon pihak: ketemu dan dijelaskan", async () => {
    const [contoh] = jalankanSql(
      `SELECT ip.telepon FROM pihak ip JOIN perkara_pihak1 x ON x.pihak_id = ip.id
        WHERE LENGTH(ip.telepon) >= 10 AND ip.telepon REGEXP '^[0-9]+$'
        GROUP BY ip.telepon ORDER BY COUNT(*) DESC, ip.telepon LIMIT 1`
    );
    const telepon = String(contoh.telepon);
    const h = await layanan.cariPerkaraHalaman(telepon, { batas: 500 });
    expect(id(h.perkara)).toEqual(harapanIdentitas(telepon));
    expect(h.perkara.length).toBeGreaterThan(0);
    expect(h.perkara.some((x) => x.cocok.some((c) => c.medan === "Telepon" && c.nilai.startsWith(telepon)))).toBe(true);
  }, 300_000);

  it("nama kuasa hukum masuk lapis cepat, dan halaman sesudahnya TIDAK berpindah ke lapis dalam", async () => {
    const kata = "Mujizah";
    const harap = harapanCepat(kata);
    expect(harap.length).toBeGreaterThan(0);
    const h = await layanan.cariPerkaraHalaman(kata, { batas: 500 });
    expect(h.lapis).toBe("cepat");
    expect(id(h.perkara)).toEqual(harap);
    // Perkara yang hanya cocok lewat kuasanya tetap menjelaskan dirinya.
    expect(h.perkara.every((x) => x.cocok.length > 0)).toBe(true);
    expect(h.perkara.some((x) => x.cocok.some((c) => c.medan === "Kuasa" && /mujizah/i.test(c.nilai)))).toBe(true);

    const sesudah = await layanan.cariPerkaraHalaman(kata, { batas: 500, lewati: 500 });
    expect(sesudah.lapis).toBe("cepat");
    expect(sesudah.perkara).toEqual([]);
    expect(sesudah.adaLagi).toBe(false);
  }, 300_000);

  it("agenda sidang dijangkau lapis dalam dan dijelaskan", async () => {
    const kata = "Duplik Rekonvensi";
    // Tidak satu pun medan lapis cepat memuat kata ini - jadi yang menjawab
    // sungguh lapis dalam.
    expect(harapanCepat(kata)).toEqual([]);
    const agenda = kolom(
      jalankanSql("SELECT DISTINCT perkara_id FROM perkara_jadwal_sidang WHERE agenda LIKE ?", [`%${kata}%`]),
      "perkara_id"
    );
    expect(agenda.length).toBeGreaterThan(0);

    const h = await layanan.cariPerkaraHalaman(kata, { batas: 500 });
    expect(h.lapis).toBe("dalam");
    expect(h.adaLagi).toBe(false);
    const hasil = new Set(id(h.perkara));
    // Setiap perkara yang agendanya memuat kata itu harus ada di hasil.
    expect(agenda.filter((x) => !hasil.has(x))).toEqual([]);
    for (const perkaraId of agenda) {
      const baris = h.perkara.find((x) => x.perkaraId === perkaraId);
      expect(baris?.cocok.some((c) => c.medan === "Agenda sidang" && /duplik rekonvensi/i.test(c.nilai))).toBe(true);
    }
  }, 300_000);
});

// ===========================================================================
// 3b. NOMOR URUT: JAWABAN TETAP, RENCANANYA LEWAT INDEKS
// ===========================================================================

/**
 * Nomor urut dicari dengan awalan LIKE di depan SUBSTRING_INDEX supaya indeks
 * nomor_perkara terpakai (3,4 detik menjadi 0,57 detik terukur). Yang dijaga
 * dua-duanya: JAWABANNYA harus tetap jawaban SUBSTRING_INDEX saja, dan
 * RENCANANYA harus sungguh rentang indeks - kalau tidak, percepatan itu
 * hilang diam-diam tanpa satu pun uji jawaban yang merah.
 */
describe.skipIf(!ADA_MYSQL)("nomor urut - jawaban tetap, lewat indeks nomor_perkara", () => {
  it("tiap nomor urut: himpunan & urutan sama dengan SQL terpisah; awalan yang lebih pendek tidak ikut", async () => {
    const [terbesar] = jalankanSql(
      "SELECT MAX(CAST(SUBSTRING_INDEX(nomor_perkara, '/', 1) AS UNSIGNED)) AS maks FROM perkara"
    );
    // "7" dan "41" sengaja pendek: awalannya ("7%", "41%") memuat puluhan
    // nomor lain - 70-79, 700-799, 410-419 - yang tidak boleh ikut.
    for (const n of ["1", "7", "41", "419", String(terbesar.maks)]) {
      const harap = kolom(
        jalankanSql(
          `SELECT p.perkara_id FROM perkara p WHERE SUBSTRING_INDEX(p.nomor_perkara, '/', 1) = ?
            ORDER BY p.tanggal_pendaftaran DESC, p.perkara_id DESC`,
          [n]
        ),
        "perkara_id"
      );
      expect(harap.length, `nomor ${n} tidak ada di register`).toBeGreaterThan(0);
      const h = await layanan.cariPerkaraHalaman(n, { batas: 500 });
      expect(h.ruasTakTerbaca).toEqual([]);
      expect(id(h.perkara), `nomor urut ${n}`).toEqual(harap);
      for (const x of h.perkara) expect(x.nomorPerkara.split("/")[0].trim(), x.nomorPerkara).toBe(n);
    }
  }, 300_000);

  it("rencana kueri yang SUNGGUH dikirim memakai rentang indeks nomor_perkara", async () => {
    // "7" sengaja ikut: awalan tunggal "7%" menaksir ratusan baris, dan
    // MariaDB lalu memilih menyisir indeks tanggal - rencana yang sama
    // lambatnya dengan SUBSTRING_INDEX sendirian. "419" tidak menangkapnya.
    for (const n of ["7", "419"]) {
      kueriTerkirim.length = 0;
      await layanan.cariPerkaraHalaman(n, { batas: 25 });
      const utama = kueriTerkirim.find((q) => /FROM perkara p\b/.test(q.sql));
      expect(utama, `kueri utama "${n}" tidak terkirim`).toBeTruthy();
      const rencana = jalankanSql(`EXPLAIN ${utama?.sql ?? ""}`, utama?.isian ?? []);
      const barisP = rencana.find((r) => r.table === "p");
      expect(barisP?.key, `"${n}": ${JSON.stringify(barisP)}`).toBe("nomor_perkara");
      expect(barisP?.type, `"${n}": ${JSON.stringify(barisP)}`).toBe("range");
    }
  }, 300_000);
});

// ===========================================================================
// 3c. TELAAH 26 SEPTEMBER 2026 - CACAT YANG TERBUKTI, DIBETULKAN
// ===========================================================================
//
// Tiap uji menjalankan cariPerkaraHalaman atas sipp_donggala dan mengadu
// jawabannya dengan SQL terpisah. Hijau berarti cacat yang terbukti di telaah
// tidak ada lagi.

describe.skipIf(!ADA_MYSQL)("telaah 26 Sep - potongan nomor perkara tidak dibanjiri nomor lain", () => {
  it("'/2019', '12/', '7/': halaman pertama = daftar nomor perkara SQL (himpunan & urutan), tanpa keterangan nomor lain", async () => {
    for (const kata of ["/2019", "12/", "7/"]) {
      const suka = `%${kata}%`;
      const harap = kolom(
        jalankanSql(
          `SELECT p.perkara_id FROM perkara p WHERE p.nomor_perkara LIKE ?
            ORDER BY p.tanggal_pendaftaran DESC, p.perkara_id DESC LIMIT 100`,
          [suka]
        ),
        "perkara_id"
      );
      expect(harap.length, kata).toBe(100);
      // Prasyarat datanya: nomor LAIN yang memuat kata ini memang ada - tanpa
      // itu uji ini tidak membuktikan apa pun tentang banjirnya.
      const lain = kolom(
        jalankanSql(
          `SELECT perkara_id FROM perkara_data_pernikahan WHERE no_kutipan_akta_nikah LIKE ?
           UNION SELECT perkara_id FROM perkara_akta_cerai WHERE nomor_akta_cerai LIKE ?`,
          [suka, suka]
        ),
        "perkara_id"
      );
      expect(lain.length, kata).toBeGreaterThan(0);

      const h = await layanan.cariPerkaraHalaman(kata, { batas: 100 });
      expect(h.ruasTakTerbaca).toEqual([]);
      expect(id(h.perkara), kata).toEqual(harap);
      expect(h.adaLagi, kata).toBe(true);
      for (const x of h.perkara) {
        expect(x.nomorPerkara.toLowerCase(), kata).toContain(kata.toLowerCase());
        expect(
          x.cocok.filter((c) => MEDAN_NOMOR_LAIN.includes(c.medan)),
          `${kata}: ${x.nomorPerkara}`
        ).toEqual([]);
      }
    }
  }, 300_000);

  it("'12/' dan '419/' SELURUHNYA = nomor perkara saja - hitungannya tidak digelembungkan nomor lain", async () => {
    for (const kata of ["12/", "419/"]) {
      const harap = kolom(
        jalankanSql(
          `SELECT p.perkara_id FROM perkara p WHERE p.nomor_perkara LIKE ?
            ORDER BY p.tanggal_pendaftaran DESC, p.perkara_id DESC`,
          [`%${kata}%`]
        ),
        "perkara_id"
      );
      expect(harap.length, kata).toBeGreaterThan(0);
      expect(harap.length, kata).toBeLessThanOrEqual(500);
      const h = await layanan.cariPerkaraHalaman(kata, { batas: 500 });
      expect(h.adaLagi, kata).toBe(false);
      expect(id(h.perkara), kata).toEqual(harap);
      expect(id(h.perkara), kata).toEqual(harapanNomor(kata));
    }
  }, 300_000);

  it("rencana: potongan yang jarang cocok lewat daftar id (PRIMARY), yang ribuan lewat LIKE - penjemputnya menyisir indeks saja", async () => {
    // "419/" 13 id: LIKE menyisir indeks tanggal sambil membaca baris satu per
    // satu (2,9 detik terukur), daftar id 0,15 detik. "7/" 1.913 id: daftar
    // seribu ke atas diubah MariaDB menjadi tabel turunan (4,7 detik), LIKE
    // 0,3 detik. Yang diperiksa rencana kueri yang SUNGGUH dikirim.
    const rencanaUtama = () => {
      const utama = kueriTerkirim.find((q) => /FROM perkara p\b/.test(q.sql));
      expect(utama, "kueri utama tidak terkirim").toBeTruthy();
      return { sql: utama?.sql ?? "", rencana: jalankanSql(`EXPLAIN ${utama?.sql ?? ""}`, utama?.isian ?? []) };
    };

    kueriTerkirim.length = 0;
    await layanan.cariPerkaraHalaman("419/", { batas: 25 });
    const penjemput = kueriTerkirim.find((q) => /FROM perkara pn\b/.test(q.sql));
    expect(penjemput, "penjemput nomor perkara tidak terkirim").toBeTruthy();
    const rencanaJemput = jalankanSql(`EXPLAIN ${penjemput?.sql ?? ""}`, penjemput?.isian ?? []);
    expect(rencanaJemput[0]?.key, JSON.stringify(rencanaJemput)).toBe("nomor_perkara");
    expect(String(rencanaJemput[0]?.Extra), JSON.stringify(rencanaJemput)).toContain("Using index");
    const jarang = rencanaUtama();
    expect(jarang.sql).toMatch(/p\.perkara_id IN \(/);
    const pJarang = jarang.rencana.find((r) => r.table === "p");
    expect(pJarang?.key, JSON.stringify(jarang.rencana)).toBe("PRIMARY");
    expect(pJarang?.type, JSON.stringify(jarang.rencana)).toBe("range");

    kueriTerkirim.length = 0;
    await layanan.cariPerkaraHalaman("7/", { batas: 25 });
    const banyak = rencanaUtama();
    expect(banyak.sql).toMatch(/p\.nomor_perkara LIKE \?/);
    expect(banyak.sql).not.toMatch(/p\.perkara_id IN \(/);
  }, 300_000);

  it("nomor akta nikah bentuk lama tetap ketemu: tidak ada nomor perkara yang cocok, jadi nomor lain dicari", async () => {
    const [contoh] = jalankanSql(
      `SELECT an.perkara_id, an.no_kutipan_akta_nikah AS nomor FROM perkara_data_pernikahan an
        WHERE an.no_kutipan_akta_nikah REGEXP '^[0-9]+/[0-9]+/(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)/[0-9]{4}$'
        ORDER BY CRC32(CONCAT('nikah-', an.perkara_id)) LIMIT 1`
    );
    const nomor = String(contoh.nomor);
    expect(jalankanSql("SELECT perkara_id FROM perkara WHERE nomor_perkara LIKE ?", [`%${nomor}%`])).toEqual([]);
    const h = await layanan.cariPerkaraHalaman(nomor, { batas: 500 });
    expect(id(h.perkara)).toEqual(harapanNomor(nomor));
    const baris = h.perkara.find((x) => x.perkaraId === String(contoh.perkara_id));
    expect(baris?.cocok).toContainEqual({ medan: "Akta nikah", nilai: rapat(nomor) });
    // Tiap perkara menjelaskan mengapa ia muncul.
    expect(h.perkara.every((x) => x.cocok.length > 0)).toBe(true);
  }, 300_000);
});

describe.skipIf(!ADA_MYSQL)("telaah 26 Sep - NIK dan telepon di 'cocok' disamarkan kecuali yang diketik", () => {
  /** Penyamaran yang diharapkan, ditulis ulang di sini: selain yang diketik menjadi "*". */
  const samar = (nomor: string, diketik: string) => {
    const i = nomor.indexOf(diketik);
    return "*".repeat(i) + diketik + "*".repeat(nomor.length - i - diketik.length);
  };
  let nikContoh = "";
  beforeAll(() => {
    if (!ADA_MYSQL) return;
    const [contoh] = jalankanSql(
      `SELECT ip.nomor_indentitas AS nik FROM pihak ip JOIN perkara_pihak1 x ON x.pihak_id = ip.id
        WHERE LENGTH(ip.nomor_indentitas) = 16 AND ip.nomor_indentitas REGEXP '^[0-9]+$'
        ORDER BY CRC32(CONCAT('nik-samar-', ip.id)) LIMIT 1`
    );
    nikContoh = String(contoh.nik);
  });

  it("sepotong NIK di tengah: nilai 'cocok' = NIK yang cocok disamarkan, hanya potongan yang diketik yang tampak", async () => {
    const potong = nikContoh.slice(4, 12);
    const h = await layanan.cariPerkaraHalaman(potong, { batas: 500 });
    const nilai = h.perkara.flatMap((x) => x.cocok.filter((c) => c.medan === "Nomor identitas").map((c) => c.nilai));
    expect(nilai.length).toBeGreaterThan(0);
    const harap = new Set(
      kolom(
        jalankanSql("SELECT DISTINCT ip.nomor_indentitas AS nik FROM pihak ip WHERE ip.nomor_indentitas LIKE ?", [
          `%${potong}%`,
        ]),
        "nik"
      ).map((n) => samar(rapat(n), potong))
    );
    for (const v of nilai) {
      const nomor = v.split(" - ")[0];
      expect(harap.has(nomor), v).toBe(true);
      expect(nomor.replace(potong, ""), v).toMatch(/^\**$/);
    }
  }, 300_000);

  it("awalan kode wilayah enam digit: ratusan pihak cocok, tidak satu pun NIK-nya keluar utuh", async () => {
    const awalan = nikContoh.slice(0, 6);
    const h = await layanan.cariPerkaraHalaman(awalan, { batas: 100 });
    const nilai = h.perkara.flatMap((x) =>
      x.cocok.filter((c) => c.medan === "Nomor identitas" || c.medan === "Telepon").map((c) => c.nilai.split(" - ")[0])
    );
    expect(nilai.length).toBeGreaterThan(0);
    for (const nomor of nilai) {
      expect(nomor.startsWith(awalan) || nomor.includes(awalan), nomor.replace(/\d/g, "9")).toBe(true);
      // Angka yang tampak hanya yang diketik.
      expect(nomor.replace(awalan, "").replace(/\*/g, ""), nomor.replace(/\d/g, "9")).toBe("");
    }
  }, 300_000);
});

describe.skipIf(!ADA_MYSQL)("telaah 26 Sep - satu orang disebut sekali, kuasa disebut sisinya", () => {
  it("juru sita yang sama (jurusita_id) dengan dua ejaan tertulis SEKALI, berejaan tahapan terakhirnya", async () => {
    const ganda = kolom(
      jalankanSql(
        `SELECT js.perkara_id FROM perkara_jurusita js WHERE js.aktif = 'Y'
          GROUP BY js.perkara_id HAVING COUNT(DISTINCT TRIM(js.jurusita_nama)) > COUNT(DISTINCT js.jurusita_id)`
      ),
      "perkara_id"
    );
    // Prasyarat: keadaan yang membuktikan cacatnya ada di salinan ini.
    expect(ganda.length).toBeGreaterThan(0);
    const h = await layanan.cariPerkaraHalaman("", { idTag: ganda, batas: 500, hariIni: "2026-09-29" });
    const harap = harapanRuas(ganda, "2026-09-29");
    expect(h.perkara.length).toBe(ganda.length);
    for (const x of h.perkara) {
      const [orang] = jalankanSql(
        "SELECT COUNT(DISTINCT jurusita_id) AS n FROM perkara_jurusita WHERE perkara_id = ? AND aktif = 'Y'",
        [Number(x.perkaraId)]
      );
      expect(x.jurusita.split("; ").length, x.nomorPerkara).toBe(Number(orang.n));
      expect(x.jurusita, x.nomorPerkara).toBe(harap.get(x.perkaraId)?.jurusita);
    }
  }, 300_000);

  it("kuasa di KEDUA sisi dan kuasa pihak kedua SAJA disebut sisinya", async () => {
    const [keduanya] = jalankanSql(
      `SELECT perkara_id FROM perkara_pengacara WHERE aktif = 'Y'
        GROUP BY perkara_id HAVING COUNT(DISTINCT pihak_ke) = 2
        ORDER BY CRC32(CONCAT('kuasa-dua-', perkara_id)) LIMIT 1`
    );
    const [keduaSaja] = jalankanSql(
      `SELECT perkara_id FROM perkara_pengacara WHERE aktif = 'Y'
        GROUP BY perkara_id HAVING MIN(pihak_ke) = 2
        ORDER BY CRC32(CONCAT('kuasa-satu-', perkara_id)) LIMIT 1`
    );
    const ids = [String(keduanya.perkara_id), String(keduaSaja.perkara_id)];
    const h = await layanan.cariPerkaraHalaman("", { idTag: ids, batas: 10, hariIni: "2026-09-29" });
    const harap = harapanRuas(ids, "2026-09-29");
    const a = h.perkara.find((x) => x.perkaraId === ids[0]);
    const b = h.perkara.find((x) => x.perkaraId === ids[1]);
    expect(a && b).toBeTruthy();
    if (!a || !b) return;
    expect(a.kuasa).toBe(harap.get(ids[0])?.kuasa);
    expect(a.kuasa.startsWith(`Kuasa ${a.sebutanPihak1}: `), a.kuasa).toBe(true);
    expect(a.kuasa.includes(`; Kuasa ${a.sebutanPihak2}: `), a.kuasa).toBe(true);
    expect(b.kuasa).toBe(harap.get(ids[1])?.kuasa);
    expect(b.kuasa.startsWith(`Kuasa ${b.sebutanPihak2}: `), b.kuasa).toBe(true);
    expect(b.kuasa.includes(`Kuasa ${b.sebutanPihak1}`), b.kuasa).toBe(false);
  }, 300_000);
});

describe("telaah 26 Sep - galat habis waktu pencarian dikatakan dalam bahasa orangnya", () => {
  afterEach(() => {
    suntikGalat = null;
  });

  it("kueri utama habis waktu: dilempar sebagai kalimat Indonesia berkode PENCARIAN_HABIS_WAKTU, sebab aslinya dibawa dan dicatat", async () => {
    // Bentuk PERSIS galat driver mysql yang terukur pada bot hidup.
    const galatDriver = Object.assign(new Error("Query inactivity timeout"), {
      code: "PROTOCOL_SEQUENCE_TIMEOUT",
      fatal: true,
      timeout: 17000,
    });
    suntikGalat = (sql) => (/FROM perkara p\b/.test(sql) ? galatDriver : null);
    const peringatan = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const galat = (await layanan.cariPerkaraHalaman("Sudarmin", { batas: 25 }).then(
        () => null,
        (e: unknown) => e
      )) as (Error & { code?: string; cause?: unknown }) | null;
      expect(galat).toBeTruthy();
      expect(galat?.code).toBe(layanan.KODE_PENCARIAN_HABIS_WAKTU);
      expect(galat?.message).toMatch(
        /^Pencarian dihentikan karena melewati batas \d+ detik untuk membaca SIPP\. Coba lagi, atau persempit dengan Saringan lain atau rentang waktu\.$/
      );
      expect(galat?.message).not.toMatch(/timeout|inactivity/i);
      expect(galat?.cause).toBe(galatDriver);
      expect(peringatan.mock.calls.some((x) => String(x[0]).includes("Query inactivity timeout"))).toBe(true);
      // Rute memakai pesanGalatPencarian - untuk galat itu, dan untuk galat
      // mentah dari penjemputan tag yang terjadi SEBELUM pencariannya.
      expect(layanan.pesanGalatPencarian(galat)).toBe(galat?.message);
      expect(layanan.pesanGalatPencarian(galatDriver)).toBe(galat?.message);
    } finally {
      peringatan.mockRestore();
    }
  });

  it("galat yang BUKAN habis waktu diteruskan apa adanya - tidak ditelan, tidak diganti", async () => {
    const galatLain = Object.assign(new Error("Table 'sipp.perkara' doesn't exist"), { code: "ER_NO_SUCH_TABLE" });
    suntikGalat = (sql) => (/FROM perkara p\b/.test(sql) ? galatLain : null);
    const galat = await layanan.cariPerkaraHalaman("419", { batas: 25 }).then(
      () => null,
      (e: unknown) => e
    );
    expect(galat).toBe(galatLain);
    expect(layanan.pesanGalatPencarian(galatLain)).toBe("Table 'sipp.perkara' doesn't exist");
  });
});

// ===========================================================================
// 4. RUTE PORTAL
// ===========================================================================

async function jalankanRute(kueri: string) {
  const { GET } = await import("@/app/api/aleta-ecourt/status-perkara/route");
  return GET(new NextRequest(`http://localhost/api/aleta-ecourt/status-perkara${kueri}`));
}

describe("rute portal meneruskan halaman dan ruas rinci", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lewati & batas sampai ke bot; adaLagi, lapis, ruasTakTerbaca, dan ruas rinci kembali", async () => {
    const alamat: string[] = [];
    const barisBot = {
      perkaraId: "9971",
      nomorPerkara: "551/Pdt.G/2026/PA.Dgl",
      jenisPerkara: "Cerai Gugat",
      tanggalDaftar: "2026-09-02",
      sudahPutus: false,
      tanggalPutusan: "",
      pihak1: "SITI",
      pihak2: "ANDI",
      sebutanPihak1: "Penggugat",
      sebutanPihak2: "Tergugat",
      kuasa: "",
      umurHari: 23,
      ecourt: true,
      cocok: [],
    };
    vi.stubGlobal("fetch", async (url: string) => {
      alamat.push(String(url));
      return new Response(
        JSON.stringify({
          ok: true,
          perkara: [barisBot],
          adaLagi: true,
          lewati: 50,
          batas: 25,
          lapis: "cepat",
          ruasTakTerbaca: ["kuasa"],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const jawab = await jalankanRute("?cari=Siti&lewati=50&batas=25");
    const teks = await jawab.clone().text();
    expect(jawab.status, teks).toBe(200);
    const isi = (await jawab.json()) as { data: Record<string, unknown> };
    expect(alamat).toHaveLength(1);
    const dikirim = new URL(alamat[0]);
    expect(dikirim.pathname).toBe("/internal/aleta-bot/sipp/status-perkara/cari");
    expect(dikirim.searchParams.get("lewati")).toBe("50");
    expect(dikirim.searchParams.get("batas")).toBe("25");
    expect(isi.data.adaLagi).toBe(true);
    expect(isi.data.lewati).toBe(50);
    expect(isi.data.lapis).toBe("cepat");
    expect(isi.data.ruasTakTerbaca).toEqual(["kuasa"]);
    expect(isi.data.perkara).toEqual([barisBot]);
  });

  it("lewati yang bukan angka tidak dikirim ke bot", async () => {
    const alamat: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      alamat.push(String(url));
      return new Response(JSON.stringify({ ok: true, perkara: [] }), { status: 200 });
    });
    const jawab = await jalankanRute("?cari=Siti&lewati=abc");
    expect(jawab.status).toBe(200);
    expect(new URL(alamat[0]).searchParams.has("lewati")).toBe(false);
    const isi = (await jawab.json()) as { data: Record<string, unknown> };
    // Bot lama tanpa keterangan halaman: adaLagi TIDAK DIKETAHUI (null) -
    // bukan dikarang "tidak ada lagi". Layar yang menilainya (halaman penuh
    // dianggap mungkin bersambung). Dulu false: bot lama yang memotong di 100
    // baris terbaca utuh, tombol Muat lebih banyak tidak pernah muncul.
    expect(isi.data.adaLagi).toBeNull();
    expect(isi.data.ruasTakTerbaca).toEqual([]);
  });

  it("habis waktu: pesan mentah bot lama diterjemahkan (dan dicatat), kalimat bot baru dan galat lain diteruskan apa adanya", async () => {
    const peringatan = vi.spyOn(console, "warn").mockImplementation(() => {});
    const kasus: Array<[string, string]> = [
      ["Query inactivity timeout", "diterjemahkan"],
      ["Query execution was interrupted, maximum statement execution time exceeded", "diterjemahkan"],
      [
        "Pencarian dihentikan karena melewati batas 15 detik untuk membaca SIPP. Coba lagi, atau persempit dengan Saringan lain atau rentang waktu.",
        "apa adanya",
      ],
      ["Table 'sipp.perkara_pk' doesn't exist", "apa adanya"],
    ];
    try {
      for (const [pesanBot, harap] of kasus) {
        vi.stubGlobal(
          "fetch",
          async () => new Response(JSON.stringify({ ok: false, error: pesanBot }), { status: 500 })
        );
        const jawab = await jalankanRute("?cari=Sudarmin");
        expect(jawab.status).toBe(200);
        const isi = (await jawab.json()) as { data: { available: boolean; message: string; perkara: unknown[] } };
        expect(isi.data.available).toBe(false);
        expect(isi.data.perkara).toEqual([]);
        if (harap === "apa adanya") {
          expect(isi.data.message, pesanBot).toBe(pesanBot);
        } else {
          expect(isi.data.message, pesanBot).toBe(
            "Pencarian dihentikan karena terlalu lama membaca SIPP (melewati batas waktu kueri). Coba lagi, atau persempit dengan Saringan lain atau rentang waktu."
          );
          // Pesan mentahnya tidak hilang: tercatat di log rute.
          expect(peringatan.mock.calls.some((x) => String(x[0]).includes(pesanBot))).toBe(true);
        }
      }
    } finally {
      peringatan.mockRestore();
    }
  });
});

const BOT_HIDUP = process.env.ALETA_UJI_BOT_HIDUP === "1";

describe.skipIf(!BOT_HIDUP)("rute portal atas bot hidup (ALETA_UJI_BOT_HIDUP=1)", () => {
  it("nomor, nama, kuasa, akta cerai, tag, dan batas 500 berhalaman", async () => {
    const env = path.resolve(process.cwd(), ".env.local");
    if (existsSync(env)) {
      for (const baris of readFileSync(env, "utf8").split(/\r?\n/)) {
        const cocok = /^(ALETA_BOT_[A-Z_]+)=(.*)$/.exec(baris.trim());
        if (cocok) process.env[cocok[1]] = cocok[2].replace(/^["']|["']$/g, "");
      }
    }
    const kasus: Array<[string, string]> = [
      ["nomor urut", "?cari=419"],
      ["nama pihak", "?cari=Rahmawati"],
      ["nama kuasa", "?cari=Mujizah"],
      ["akta cerai", "?cari=376%2FAC%2F2026"],
      ["tag ghaib", "?tag=ghaib&batas=25"],
      ["batas 500 lewati 500", "?tahun=2025&batas=500&lewati=500"],
    ];
    for (const [nama, kueri] of kasus) {
      const mulai = Date.now();
      const jawab = await jalankanRute(kueri);
      const teks = await jawab.clone().text();
      expect(jawab.status, teks).toBe(200);
      const isi = (await jawab.json()) as { data: { available: boolean; perkara: Baris[]; adaLagi: boolean; ruasTakTerbaca: string[]; message?: string } };
      expect(isi.data.available, isi.data.message).toBe(true);
      expect(isi.data.ruasTakTerbaca).toEqual([]);
      console.log(
        `[bot hidup] ${nama}: ${isi.data.perkara.length} baris, adaLagi=${isi.data.adaLagi}, ${Date.now() - mulai} ms`
      );
      for (const x of isi.data.perkara) {
        expect(typeof x.pihak1).toBe("string");
        expect(typeof x.sebutanPihak1).toBe("string");
        expect(x.sebutanPihak1.length).toBeGreaterThan(0);
        expect(typeof x.jumlahSidang).toBe("number");
      }
    }
  }, 600_000);
});
