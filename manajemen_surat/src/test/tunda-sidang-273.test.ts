// @vitest-environment node
/**
 * ============================================================================
 * TOMBOL TUNDA 273/Pdt.G/2026/PA.Dgl - 7 OKT 2026
 * ============================================================================
 *
 * Keluhan: "saya tunda menggunakan aleta tiba-tiba error dan tidak mau tunda,
 * cuman dia taruh keterangan tunda tapi tidak menunda sidang".
 *
 * Bukti di server (baca-saja, 7 Okt 2026):
 *   - aleta_bot_jejak_penetapan #86 13:34:56 tunda 9729 berhasil=0
 *     alasan=gagal_menulis; #87 13:35:03 alasan=sidang_sudah_ditunda.
 *   - sys_audittrail 506191 13:34:56 sitti UPDATE perkara_jadwal_sidang
 *     [id=20219] ditunda=Y alasan "Panggil Tergugat" - TANPA baris INSERT.
 *   - perkara_jadwal_sidang.verzet NOT NULL DEFAULT 'T'; ALETA menyisipkan
 *     verzet = NULL -> ER_BAD_NULL_ERROR 1048 (diulang di MariaDB lokal).
 *   - Langkah ditulis satu-satu tanpa transaksi: langkah 1-2 tertinggal.
 *
 * Basis data SIPP ditiru di sini (require.cache, pola
 * berkas-ecourt-tidak-terbaca.test.ts) LENGKAP dengan aturan NOT NULL dan
 * transaksi, supaya kegagalannya DIBUAT, bukan dibayangkan.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const require_ = createRequire(import.meta.url);
const AKAR_BOT = path.resolve(process.env.ALETA_UJI_AKAR_BOT || path.resolve(process.cwd(), "../aleta_bot"));

type Baris = Record<string, unknown>;
type Galat = Error & { code?: string; sqlMessage?: string };

// ---------------------------------------------------------------------------
// Tiruan SIPP
// ---------------------------------------------------------------------------
type Keadaan = {
  jadwal: Map<number, Baris>;
  audit: Baris[];
  proses: Baris[];
  perkaraDiubah: number;
};

let sipp: Keadaan;
let pp: Baris[];
let antrianBaris: Baris[];
let gagalPada: RegExp | null;
let transaksiDipakai: number;
let antrianDisetel: unknown[][] = [];

function keadaanAwal(): Keadaan {
  const jadwal = new Map<number, Baris>();
  jadwal.set(19965, {
    id: 19965, perkara_id: 9729, tanggal_sidang: "2026-09-23", jam_sidang: "13:39:04", urutan: 9,
    ditunda: "Y", alasan_ditunda: "Pembuktian Lanjutan Penggugat", agenda: "Pembuktian Lanjutan Penggugat",
    ruangan_id: 1, ruangan: "Ruang Sidang 1 Dalam Gedung", sidang_keliling: "T", verzet: "T", keberatan: "T",
    ikrar_talak: "T", dihadiri_oleh: 1, sifat_sidang: "Y",
  });
  // Baris sidang 7 Okt SEBELUM tombol ditekan (jam jadwal 09:00).
  jadwal.set(20219, {
    id: 20219, perkara_id: 9729, tanggal_sidang: "2026-10-07", jam_sidang: "09:00:00", sampai_jam: null,
    urutan: 10, ditunda: "T", alasan_ditunda: null, agenda: "Pembuktian Tergugat", ruangan_id: 1,
    ruangan: "Ruang Sidang 1 Dalam Gedung", sidang_keliling: "T", verzet: "T", keberatan: "T", ikrar_talak: "T",
    dihadiri_oleh: null, sifat_sidang: "Y",
  });
  jadwal.set(20343, {
    id: 20343, perkara_id: 1, tanggal_sidang: "2026-10-08", urutan: 1, ditunda: "T", verzet: "T",
  });
  return { jadwal, audit: [], proses: [], perkaraDiubah: 0 };
}

function salin(k: Keadaan): Keadaan {
  return {
    jadwal: new Map([...k.jadwal].map(([id, b]) => [id, { ...b }])),
    audit: k.audit.map((x) => ({ ...x })),
    proses: k.proses.map((x) => ({ ...x })),
    perkaraDiubah: k.perkaraDiubah,
  };
}

function galatSql(kode: string, pesan: string): Galat {
  const g = new Error(`${kode}: ${pesan}`) as Galat;
  g.code = kode;
  g.sqlMessage = pesan;
  return g;
}

function jawab(sqlMentah: string, params: unknown[] = []): unknown {
  const sql = sqlMentah.replace(/\s+/g, " ").trim();
  const p = params as unknown[];

  if (gagalPada && gagalPada.test(sql)) throw galatSql("ER_LOCK_WAIT_TIMEOUT", "Lock wait timeout exceeded");

  if (/information_schema\.COLUMNS/.test(sql)) {
    return [{ tabel: "ruangan_sidang", kolom: "id" }, { tabel: "ruangan_sidang", kolom: "nama" }];
  }
  if (/DATE_FORMAT\(NOW\(\)/.test(sql)) return [{ saat: "2026-10-07 13:34:56" }];
  // 13 Okt 2026: jam SIPP (WIB) = UTC + 7 jam = 12:34:56 - jam yang DITULIS.
  if (/UTC_TIMESTAMP/.test(sql)) return [{ utc: "2026-10-07 05:34:56" }];
  if (/FROM perkara_jadwal_sidang j JOIN perkara p/.test(sql)) {
    const b = sipp.jadwal.get(Number(p[0]));
    if (!b) return [];
    return [{
      jadwalId: b.id, perkaraId: b.perkara_id, tanggalSidang: b.tanggal_sidang, jamSidang: b.jam_sidang,
      sampaiJam: b.sampai_jam, agenda: b.agenda, agendaId: null, urutan: b.urutan, ditunda: b.ditunda,
      alasanDitunda: b.alasan_ditunda, ruanganId: b.ruangan_id, ruangan: b.ruangan, sidangKeliling: b.sidang_keliling,
      sifatSidang: b.sifat_sidang, dihadiriOleh: b.dihadiri_oleh, verzet: b.verzet, keberatan: b.keberatan,
      ikrarTalak: b.ikrar_talak, nomorPerkara: "273/Pdt.G/2026/PA.Dgl", alurPerkaraId: 2, jenisPerkaraId: 1,
      jenisPerkara: "Harta Bersama",
    }];
  }
  if (/FROM perkara_panitera_pn c LEFT JOIN v_users/.test(sql)) return pp.filter((r) => r.aktif === "Y");
  if (/FROM perkara_panitera_pn c JOIN v_users/.test(sql)) {
    return pp
      .filter((r) => r.aktif === "Y" && Number(r.block) === 0 && r.username)
      .map((r) => ({ username: r.username, fullname: r.fullname }));
  }
  if (/FROM perkara_hakim_pn/.test(sql)) return [{ username: "hakim1", fullname: "Hakim Satu" }];
  if (/FROM sys_users WHERE username = \?/.test(sql)) {
    return p[0] === "admin" ? [{ username: "admin", fullname: "Administrator" }] : [];
  }
  if (/FROM proses_alur_perkara/.test(sql)) {
    return [{ tahapanId: 14, tahapanNama: "Persidangan", prosesId: 200, prosesNama: "Persidangan" }];
  }
  if (/COALESCE\(MAX\(id\), 0\) \+ 1 AS berikutnya FROM perkara_jadwal_sidang/.test(sql)) {
    return [{ berikutnya: Math.max(...sipp.jadwal.keys()) + 1 }];
  }
  if (/SELECT COUNT\(\*\) AS n FROM perkara_jadwal_sidang/.test(sql)) {
    const [perkara, id, urutan, tanggal] = p as [number, number, number, string];
    const n = [...sipp.jadwal.values()].filter(
      (b) =>
        b.perkara_id === perkara &&
        b.id !== id &&
        (Number(b.urutan) > urutan || String(b.tanggal_sidang) > tanggal)
    ).length;
    return [{ n }];
  }
  if (/FROM ruangan_sidang WHERE id = \?/.test(sql)) {
    return Number(p[0]) === 1 ? [{ id: 1, nama: "Ruang Sidang 1 Dalam Gedung", keliling: "T" }] : [];
  }
  if (/FROM ruangan_sidang/.test(sql)) return [{ id: 1, kode: "R1", nama: "Ruang Sidang 1 Dalam Gedung", keliling: "T" }];
  if (/FROM status_putusan WHERE id = \?/.test(sql)) return [{ id: 62, nama: "Dikabulkan" }];

  // ---- tulisan ----
  if (/^UPDATE perkara_jadwal_sidang SET/.test(sql)) {
    const id = Number(p[p.length - 1]);
    const b = sipp.jadwal.get(id);
    if (!b) return { affectedRows: 0 };
    const kolom = [...sql.matchAll(/(\w+) = \?/g)].map((m) => m[1]).filter((k) => k !== "id");
    kolom.forEach((k, i) => {
      b[k] = p[i];
    });
    return { affectedRows: 1 };
  }
  if (/^INSERT INTO perkara_jadwal_sidang/.test(sql)) {
    const kolom = sql.slice(sql.indexOf("(") + 1, sql.indexOf(")")).split(",").map((x) => x.trim());
    // urutan = subkueri; nilainya dihitung dari param perkara di posisi itu.
    const baris: Baris = {};
    let i = 0;
    for (const k of kolom) {
      if (k === "urutan") {
        const perkara = Number(p[i]);
        baris.urutan =
          Math.max(0, ...[...sipp.jadwal.values()].filter((b) => b.perkara_id === perkara).map((b) => Number(b.urutan))) + 1;
      } else {
        baris[k] = p[i];
      }
      i += 1;
    }
    // ATURAN SKEMA SIPP SUNGGUHAN: verzet char(1) NOT NULL DEFAULT 'T'.
    if (baris.verzet === null) throw galatSql("ER_BAD_NULL_ERROR", "Column 'verzet' cannot be null");
    if (sipp.jadwal.has(Number(baris.id))) throw galatSql("ER_DUP_ENTRY", `Duplicate entry '${baris.id}' for key 'PRIMARY'`);
    sipp.jadwal.set(Number(baris.id), { ditunda: "T", ...baris });
    return { affectedRows: 1, insertId: 0 };
  }
  if (/^INSERT INTO sys_audittrail/.test(sql)) {
    sipp.audit.push({ datetime: p[0], username: p[2], tablename: p[3], action: p[5], title: p[6] });
    return { affectedRows: 1, insertId: sipp.audit.length };
  }
  if (/^CALL perkara_proses_update/.test(sql)) {
    sipp.proses.push({ perkara: p[0], proses: p[3], oleh: p[7] });
    return [];
  }
  if (/^UPDATE perkara p JOIN/.test(sql)) {
    sipp.perkaraDiubah += 1;
    return { affectedRows: 1 };
  }
  if (/^UPDATE antrian SET status/.test(sql)) {
    antrianDisetel.push([...p]);
    return { affectedRows: 0 };
  }
  throw new Error(`tiruan SIPP tidak mengenal kueri: ${sql.slice(0, 120)}`);
}

function panggil(sql: unknown, params: unknown, callback: unknown, olah: (s: string, p: unknown[]) => unknown) {
  const selesai = (typeof params === "function" ? params : callback) as (g: unknown, r?: unknown) => void;
  const nilai = (Array.isArray(params) ? params : []) as unknown[];
  const teks = typeof sql === "string" ? sql : String((sql as { sql?: string }).sql || "");
  setImmediate(() => {
    try {
      selesai(null, olah(teks, nilai));
    } catch (g) {
      selesai(g);
    }
  });
}

const dbTiruan = {
  query(sql: unknown, params: unknown, callback?: unknown) {
    panggil(sql, params, callback, jawab);
  },
  getConnection(cb: (g: unknown, s?: unknown) => void) {
    let cadangan: Keadaan | null = null;
    const sambungan = {
      query(sql: unknown, params: unknown, callback?: unknown) {
        panggil(sql, params, callback, (teks, nilai) => {
          const t = teks.trim().toUpperCase();
          if (t === "START TRANSACTION" || t === "BEGIN") {
            transaksiDipakai += 1;
            cadangan = salin(sipp);
            return {};
          }
          if (t === "COMMIT") {
            cadangan = null;
            return {};
          }
          if (t === "ROLLBACK") {
            if (cadangan) sipp = cadangan;
            cadangan = null;
            return {};
          }
          return jawab(teks, nilai);
        });
      },
      release() {},
    };
    setImmediate(() => cb(null, sambungan));
  },
};

// ---------------------------------------------------------------------------
// Pemuatan modul bot di atas tiruan
// ---------------------------------------------------------------------------
type Layanan = {
  susunRencanaTunda: (m: Baris) => Promise<Baris & { ok: boolean; langkah?: Baris[] }>;
  susunRencanaPutus: (m: Baris) => Promise<Baris & { ok: boolean; langkah?: Baris[] }>;
  jalankanRencana: (r: unknown, o: { kering: boolean }) => Promise<Baris & { ok: boolean }>;
};
let layanan: Layanan;

beforeAll(() => {
  for (const kunci of Object.keys(require_.cache)) {
    if (kunci.startsWith(AKAR_BOT) && !kunci.includes("node_modules")) delete require_.cache[kunci];
  }
  const jalurDb = require_.resolve(path.join(AKAR_BOT, "db_config.js"));
  require_(jalurDb);
  require_.cache[jalurDb]!.exports = dbTiruan;

  const jalurLuar = require_.resolve(path.join(AKAR_BOT, "services/externalDbService.js"));
  const luarAsli = require_(jalurLuar);
  require_.cache[jalurLuar]!.exports = {
    ...luarAsli,
    query: async (kunci: string, sql: string, params: unknown[]) => {
      if (kunci !== "antrian_sidang" || !/antrian_sidang/.test(sql)) throw new Error("bukan kueri antrian");
      return antrianBaris.filter((b) => b.perkara_id === params[0] && b.tanggal_sidang === params[1]);
    },
  };

  layanan = require_(path.join(AKAR_BOT, "services/sidangHasilService.js"));
});

beforeEach(() => {
  sipp = keadaanAwal();
  pp = [
    { panitera_id: 22, panitera_nama: "Sri Wahyuni, S.H.", aktif: "T", tanggal_penetapan: "2026-04-27", username: "Sri Wahyuni", fullname: "Sri Wahyuni, S.H.", block: 1 },
    { panitera_id: 29, panitera_nama: "Sitti Nurhidayah, S.H.I., M.H", aktif: "Y", tanggal_penetapan: "2026-07-29", username: "sitti", fullname: "Sitti Nurhidayah, S.H.I., M.H", block: 0 },
  ];
  // Baris antrian 273 hari itu: masuk ruang 13:12:50, hanya pihak_1 yang datang.
  antrianBaris = [
    { id: 20219, perkara_id: 9729, tanggal_sidang: "2026-10-07", ruangan_id: 1, disidang: 1, jam_sidang: "13:12:50", pihak_1: "2026-10-07 11:12:07", pihak_2: null },
  ];
  gagalPada = null;
  transaksiDipakai = 0;
  antrianDisetel = [];
});

/** Yang dikirim layar Jadwal Sidang pada 273 (jejak #86 + audit 506191). */
const MINTA_273 = {
  jadwalId: 20219,
  alasanTunda: "Panggil Tergugat",
  tanggalBerikut: "2026-10-14",
  jamBerikut: "09:00",
  jamSekarang: "09:00:00",
  agendaBerikut: "Pembuktian Tergugat",
  dihadiriOleh: 1,
  operator: "usr-super",
  ip: "172.18.0.2",
};

function setengahJadi() {
  const hariIni = sipp.jadwal.get(20219)!;
  const berikut = [...sipp.jadwal.values()].filter((b) => b.perkara_id === 9729 && Number(b.urutan) > 10);
  return hariIni.ditunda === "Y" && berikut.length === 0;
}

describe("kasus 273: tunda tidak boleh setengah jadi", () => {
  it("tunda 273 persis seperti dikirim layar: UTUH - sidang hari ini ditunda DAN sidang berikutnya lahir", async () => {
    const rencana = await layanan.susunRencanaTunda({ ...MINTA_273 });
    expect(rencana.ok, JSON.stringify(rencana)).toBe(true);
    const hasil = await layanan.jalankanRencana(rencana, { kering: false });
    expect(hasil.ok, JSON.stringify(hasil)).toBe(true);
    expect(setengahJadi()).toBe(false);

    const baru = [...sipp.jadwal.values()].find((b) => b.perkara_id === 9729 && Number(b.urutan) === 11)!;
    expect(baru).toBeTruthy();
    expect(baru.tanggal_sidang).toBe("2026-10-14");
    expect(baru.agenda).toBe("Pembuktian Tergugat");
    // Bendera 'T' tegas, tidak pernah NULL - sebab langsung kegagalan 273.
    expect([baru.verzet, baru.keberatan, baru.ikrar_talak]).toEqual(["T", "T", "T"]);
    expect(sipp.audit.map((a) => a.action)).toEqual(["UPDATE", "INSERT", "UPDATE"]);
  });

  it("13 Okt 2026: jam yang ditulis = jam SIPP (WIB), bukan NOW() basis data (WITA)", async () => {
    const rencana = await layanan.susunRencanaTunda({ ...MINTA_273 });
    const hasil = await layanan.jalankanRencana(rencana, { kering: false });
    expect(hasil.ok).toBe(true);
    expect(new Set(sipp.audit.map((a) => a.datetime))).toEqual(new Set(["2026-10-07 12:34:56"]));
    const baru = [...sipp.jadwal.values()].find((b) => b.perkara_id === 9729 && Number(b.urutan) === 11)!;
    expect(baru.diinput_tanggal).toBe("2026-10-07 12:34:56");
  });

  it("langkah yang gagal di tengah membatalkan seluruhnya - tidak ada 'keterangan tunda tanpa sidang berikutnya'", async () => {
    gagalPada = /^INSERT INTO perkara_jadwal_sidang/;
    const rencana = await layanan.susunRencanaTunda({ ...MINTA_273 });
    expect(rencana.ok).toBe(true);
    const hasil = await layanan.jalankanRencana(rencana, { kering: false });
    expect(hasil.ok).toBe(false);

    // Keadaan SIPP kembali persis seperti sebelum tombol ditekan.
    expect(setengahJadi()).toBe(false);
    expect(sipp.jadwal.get(20219)!.ditunda).toBe("T");
    expect(sipp.jadwal.get(20219)!.alasan_ditunda).toBeNull();
    expect(sipp.audit).toEqual([]);
    expect(hasil.dipulihkan).toBe(true);
    expect(transaksiDipakai).toBe(1);
  });

  it("gagal di langkah terakhir (UPDATE perkara) pun dibatalkan utuh", async () => {
    gagalPada = /^UPDATE perkara p JOIN/;
    const rencana = await layanan.susunRencanaTunda({ ...MINTA_273 });
    const hasil = await layanan.jalankanRencana(rencana, { kering: false });
    expect(hasil.ok).toBe(false);
    expect(sipp.jadwal.size).toBe(3);
    expect(sipp.jadwal.get(20219)!.ditunda).toBe("T");
    expect(sipp.audit).toEqual([]);
  });

  it("sidang yang tertinggal setengah jadi (keadaan 273 di server) disebut dengan namanya, bukan 'sudah ditunda'", async () => {
    Object.assign(sipp.jadwal.get(20219)!, { ditunda: "Y", alasan_ditunda: "Panggil Tergugat" });
    const rencana = await layanan.susunRencanaTunda({ ...MINTA_273 });
    expect(rencana.ok).toBe(false);
    expect(rencana.alasan).toBe("tunda_belum_utuh");
  });

  it("tanggal Sabtu/Minggu ditolak seperti SIPP", async () => {
    const rencana = await layanan.susunRencanaTunda({ ...MINTA_273, tanggalBerikut: "2026-10-17" });
    expect(rencana.alasan).toBe("tanggal_berikut_akhir_pekan");
    expect(sipp.audit).toEqual([]);
  });
});

describe("mengikuti antrian sidang", () => {
  it("jam mulai = jam masuk ruang di antrian, kehadiran bawaan dari pihak_1/pihak_2", async () => {
    const rencana = await layanan.susunRencanaTunda({ ...MINTA_273, dihadiriOleh: undefined });
    const ubah = (rencana.langkah as Baris[])[0];
    const params = ubah.params as unknown[];
    // jam_sidang, sampai_jam, agenda, dihadiri_oleh, ...
    // Jam borang SIPP: HH:mm, detik 00 (audit pola 18 Okt 2026, jamBorang).
    expect(params[0]).toBe("13:12:00");
    expect(params[3]).toBe(2);
  });

  it("tanpa baris antrian: kembali ke jam jadwal dan pilihan blangko", async () => {
    antrianBaris = [];
    const rencana = await layanan.susunRencanaTunda({ ...MINTA_273 });
    const params = (rencana.langkah as Baris[])[0].params as unknown[];
    expect(params[0]).toBe("09:00:00");
    expect(params[3]).toBe(1);
  });

  it("putus memakai jam masuk ruang yang sama", async () => {
    const rencana = await layanan.susunRencanaPutus({ jadwalId: 20219, statusPutusanId: 62, operator: "usr-super" });
    expect(rencana.ok, JSON.stringify(rencana)).toBe(true);
    const params = (rencana.langkah as Baris[])[0].params as unknown[];
    // Jam borang SIPP: HH:mm, detik 00 (audit pola 18 Okt 2026, jamBorang).
    expect(params[2]).toBe("13:12:00");
  });
});

describe("penginput di SIPP = panitera sidang (PP) perkara - keputusan 7 Okt 2026", () => {
  it("tercatat atas nama PP walau yang menekan admin dan mengirim username lain", async () => {
    const rencana = await layanan.susunRencanaTunda({ ...MINTA_273, olehUsername: "admin", operator: "usr-super" });
    const hasil = await layanan.jalankanRencana(rencana, { kering: false });
    expect(hasil.ok).toBe(true);
    expect(sipp.audit.every((a) => a.username === "sitti")).toBe(true);
    expect(sipp.jadwal.get(20219)!.diperbaharui_oleh).toBe("sitti");
    const baru = [...sipp.jadwal.values()].find((b) => b.perkara_id === 9729 && Number(b.urutan) === 11)!;
    expect(baru.diinput_oleh).toBe("sitti");
  });

  it("PP tidak tercatat: DITOLAK, tidak jatuh ke akun yang dikirim", async () => {
    pp = [];
    const rencana = await layanan.susunRencanaTunda({ ...MINTA_273, olehUsername: "admin" });
    expect(rencana.ok).toBe(false);
    expect(rencana.alasan).toBe("panitera_sidang_tidak_ketemu");
  });

  it("dua PP aktif: DITOLAK, ALETA tidak memilih", async () => {
    pp.push({ panitera_id: 31, panitera_nama: "PP Kedua", aktif: "Y", tanggal_penetapan: "2026-08-01", username: "pp2", fullname: "PP Kedua", block: 0 });
    const rencana = await layanan.susunRencanaTunda({ ...MINTA_273 });
    expect(rencana.alasan).toBe("panitera_sidang_ganda");
  });

  it("akun SIPP PP diblokir: DITOLAK dengan sebabnya", async () => {
    pp[1].block = 1;
    const rencana = await layanan.susunRencanaPutus({ jadwalId: 20219, statusPutusanId: 62, operator: "x" });
    expect(rencana.alasan).toBe("akun_sipp_pp_diblokir");
  });
});

describe("alur tombol + jejak jujur + pesan sebab", () => {
  type Alur = {
    jalankanHasilSidang: (
      jalan: string,
      badan: Baris,
      konteks: Baris,
      deps: Baris
    ) => Promise<{ status: number; body: Baris }>;
    keadaanHasilSidang: (id: unknown, deps: Baris) => Promise<{ status: number; body: Baris }>;
  };
  let alur: Alur;
  const jejak: Baris[] = [];
  beforeAll(() => {
    alur = require_(path.join(AKAR_BOT, "services/sidangHasilAlur.js"));
  });
  beforeEach(() => {
    jejak.length = 0;
  });
  const deps = () => ({
    layanan,
    jejak: { catat: async (j: Baris) => void jejak.push(j) },
    jeda: { jeda: async () => 0 },
    penetapan: require_(path.join(AKAR_BOT, "services/penetapanTulisService.js")),
  });
  const badan = { ...MINTA_273, kering: false, operator: "usr-hakim", operatorNama: "Hakim Penekan", operatorAkunSipp: "hakim1" };

  it("jejak ALETA menyimpan penekan sebenarnya, SIPP mencatat PP", async () => {
    const { status, body } = await alur.jalankanHasilSidang("tunda", badan, { ip: "10.0.0.5" }, deps());
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(jejak).toHaveLength(1);
    expect(jejak[0].operator).toContain("Hakim Penekan");
    expect(jejak[0].operator).toContain("usr-hakim");
    expect(jejak[0].operator).toContain("SIPP: hakim1");
    expect(jejak[0].akunSipp).toBe("sitti");
    expect(sipp.audit.every((a) => a.username === "sitti")).toBe(true);
  });

  it("gagal menulis: petugas membaca SEBABNYA dan bahwa tidak ada yang tertinggal; jejak menyimpan pesan teknis", async () => {
    gagalPada = /^INSERT INTO perkara_jadwal_sidang/;
    const { status, body } = await alur.jalankanHasilSidang("tunda", badan, {}, deps());
    expect(status).toBe(409);
    expect(body.kode).toBe("gagal_menulis");
    const pesan = String(body.error);
    expect(pesan).toMatch(/TIDAK tersimpan/);
    expect(pesan).toMatch(/sidang berikutnya 2026-10-14/);
    expect(pesan).toMatch(/Lock wait timeout/);
    expect(pesan).toMatch(/dibatalkan/);
    expect(pesan).not.toMatch(/\bgalat\b|peladen|borang/i);
    expect(String(jejak[0].alasan)).toMatch(/gagal_menulis \(dibatalkan utuh\) perkara_jadwal_sidang INSERT: .*Lock wait/);
    expect(setengahJadi()).toBe(false);
  });

  it("PP tidak tercatat: pesan menyuruh mengisi PP di SIPP", async () => {
    pp = [];
    const { status, body } = await alur.jalankanHasilSidang("putus", { jadwalId: 20219, statusPutusanId: 62, operator: "u", kering: false }, {}, deps());
    expect(status).toBe(400);
    expect(String(body.error)).toMatch(/Panitera sidang \(PP\) perkara ini tidak tercatat di SIPP - isi dulu/);
    expect(jejak[0].berhasil).toBe(false);
  });

  it("keadaan blangko menyebut atas nama siapa akan tercatat (dan antriannya)", async () => {
    const { body } = await alur.keadaanHasilSidang(20219, deps());
    expect(body.atasNama).toMatchObject({ ok: true, username: "sitti", namaLengkap: "Sitti Nurhidayah, S.H.I., M.H" });
    expect(body.antrian).toMatchObject({ jamMasuk: "13:12:50", dihadiriOleh: 2, ruanganId: 1 });
  });

  it("sidang 273 setengah jadi: pesan menjelaskan bahwa jadwal berikutnya TIDAK ADA", async () => {
    Object.assign(sipp.jadwal.get(20219)!, { ditunda: "Y", alasan_ditunda: "Panggil Tergugat" });
    const { body } = await alur.jalankanHasilSidang("tunda", badan, {}, deps());
    expect(body.kode).toBe("tunda_belum_utuh");
    expect(String(body.error)).toMatch(/jadwal sidang berikutnya TIDAK ADA/);
  });

  it("putus atas sidang yang sudah ditunda dan punya sidang sesudahnya ditolak (tidak membuat jadwal yatim)", async () => {
    const { body } = await alur.jalankanHasilSidang("putus", { jadwalId: 19965, statusPutusanId: 62, operator: "u", kering: false }, {}, deps());
    expect(body.kode).toBe("sidang_ditunda_tidak_dapat_diputus");
    expect(sipp.jadwal.get(19965)!.ditunda).toBe("Y");
  });

  it("uji rilis 9 Okt: putus yang dicatat dengan tanggal putusan lain menggerakkan antrian pada TANGGAL SIDANG", async () => {
    const { status, body } = await alur.jalankanHasilSidang(
      "putus",
      { jadwalId: 20219, statusPutusanId: 62, tanggalPutus: "2026-10-08", operator: "u", kering: false },
      {},
      deps()
    );
    expect(status, JSON.stringify(body)).toBe(200);
    expect(antrianDisetel).toHaveLength(1);
    // [status, perkara_id, tanggal_sidang]
    expect(antrianDisetel[0][1]).toBe(9729);
    expect(antrianDisetel[0][2]).toBe("2026-10-07");
  });
});
