/**
 * ============================================================================
 * ARTI disidang APLIKASI ANTRIAN - 5 OKTOBER 2026 (butir 5)
 * ============================================================================
 *
 * Dibaca dari sumber aplikasi antrian di server (_fungsi.php, menu.sidang.php)
 * dan data hidupnya: NULL = menunggu, 1..9 = SEDANG disidang di ruang itu
 * (= ruangan_id; PROSES menulis disidang = ruang, jam_sidang = now()), 10 =
 * SELESAI. Sampai 1.183.0 ALETA membaca 10 sebagai "dipanggil", menulis 10
 * saat memanggil, dan tidak pernah mendeteksi perkara yang sedang di ruang.
 *
 * Uji di sini PERILAKU: fungsi murni portal, layanan bot atas basis data
 * tiruan, dan pemanggilan atas tabel antrian sungguhan di pg-mem (tulisan
 * SQL-nya dijalankan, bukan dicocokkan teksnya).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import path from "node:path";
import { createRequire } from "node:module";
import { DataType, newDb } from "pg-mem";
import { petaSidangBerjalan } from "@/lib/jadwal-sidang-2okt";
import { hitungTigaJarak, kunciWaktu, type BarisWaktuAntrian } from "@/lib/tiga-jarak-sidang";

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));

const HARI = "2026-10-05";

function baris(ubah: Partial<BarisWaktuAntrian> & { perkaraId: string }): BarisWaktuAntrian {
  return {
    tanggalSidang: HARI,
    nomorAntrian: null,
    noRuang: 1,
    ruanganId: 1,
    ambilPihak1: "",
    ambilPihak2: "",
    ambilSaksi: "",
    ambilTerawal: "",
    jamJadwal: "",
    panggilPertama: "",
    panggilTerakhir: "",
    jumlahPanggil: 0,
    online: null,
    namaPetugas: "",
    sumber: "langsung",
    ...ubah,
  };
}

// ============================================================================
// PORTAL - "SEDANG BERJALAN" DARI KEADAAN LANGSUNG
// ============================================================================

describe("petaSidangBerjalan memakai disidang langsung aplikasi antrian", () => {
  it("yang SEDANG di ruang (disidang = 1) berjalan, walau sesudahnya ada perkara lain dipanggil lalu dibatalkan", () => {
    // 609 masuk Ruang 1 pukul 10:19. 610 sempat dipanggil 10:25 lalu BATAL
    // (disidang kembali NULL). Tebakan lama: "terakhir dipanggil" = 610.
    const daftar = [
      baris({ perkaraId: "609", panggilTerakhir: `${HARI} 10:19:04`, jumlahPanggil: 1, disidang: 1 }),
      baris({ perkaraId: "610", panggilTerakhir: `${HARI} 10:25:00`, jumlahPanggil: 1, disidang: null }),
    ];
    const hasil = petaSidangBerjalan(daftar, { hariIni: HARI });
    expect(Object.keys(hasil.berjalan)).toEqual([kunciWaktu(HARI, "609")]);
    const b = hasil.berjalan[kunciWaktu(HARI, "609")];
    expect(b.sumber).toBe("antrian-proses");
    expect(b.sejak).toBe(`${HARI} 10:19:04`);
    expect(hasil.perRuang["Ruang 1"]?.perkaraId).toBe("609");
  });

  it("disidang = 10 (selesai) TIDAK berjalan walau terakhir dipanggil di ruangnya dan belum ada tanda selesai lain", () => {
    const daftar = [baris({ perkaraId: "611", panggilTerakhir: `${HARI} 09:40:00`, jumlahPanggil: 1, disidang: 10 })];
    const hasil = petaSidangBerjalan(daftar, { hariIni: HARI });
    expect(hasil.berjalan).toEqual({});
  });

  it("tanpa keadaan langsung (rekaman saja / bot lama) tebakan semula tetap: terakhir dipanggil = berjalan", () => {
    const daftar = [baris({ perkaraId: "612", panggilTerakhir: `${HARI} 09:40:00`, jumlahPanggil: 1, sumber: "rekaman" })];
    const hasil = petaSidangBerjalan(daftar, { hariIni: HARI });
    expect(hasil.berjalan[kunciWaktu(HARI, "612")]?.sumber).toBe("panggilan");
  });

  it("tidak dobel bila bot sudah mengirim baris itu di berjalan.proses", () => {
    const daftar = [baris({ perkaraId: "609", panggilTerakhir: `${HARI} 10:19:04`, jumlahPanggil: 1, disidang: 1 })];
    const hasil = petaSidangBerjalan(daftar, {
      hariIni: HARI,
      berjalan: { manual: {}, proses: [{ perkaraId: "609", tanggalSidang: HARI, noRuang: 1, sejak: `${HARI} 10:19:04` }] },
    });
    expect(Object.keys(hasil.berjalan)).toEqual([kunciWaktu(HARI, "609")]);
    expect(hasil.berjalan[kunciWaktu(HARI, "609")].sumber).toBe("antrian-proses");
  });

  it("lama sidang: perkara terakhir di ruangnya yang sudah 10 tidak lagi berdetak", () => {
    const tiga = hitungTigaJarak(
      [baris({ perkaraId: "611", panggilTerakhir: `${HARI} 09:40:00`, jumlahPanggil: 1, disidang: 10 })],
      { hariIni: HARI }
    );
    expect(tiga[kunciWaktu(HARI, "611")].lamaSidang.keadaan).toBe("tidak-diketahui");
  });
});

// ============================================================================
// BOT - ARTI INI BAWAAN, TANPA LINGKUNGAN
// ============================================================================

type Layanan = Record<string, (...a: never[]) => Promise<Record<string, unknown>>>;
const selesaiMod = require_(path.join(AKAR, "aleta_bot/services/sidangSelesaiService.js")) as {
  buatLayanan: (deps: Record<string, unknown>) => Layanan;
};

describe("sidangSelesaiService - proses (1..9) dan selesai (10) dibaca TANPA env", () => {
  const simpan: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ["ALETA_ANTRIAN_DISIDANG_PROSES", "ALETA_ANTRIAN_DISIDANG_SELESAI"]) {
      simpan[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(simpan)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("petaSelesai: baris disidang = ruang menjadi 'berjalan.proses', baris 10 menjadi selesai dari antrian ruang tunggu", async () => {
    // Tiruan tabel antrian: SELECT dijawab dengan menyaring baris menurut
    // kondisi yang DIMINTA (nilai parameternya), bukan menurut teksnya.
    const tabel = [
      { perkaraId: "609", tanggalSidang: HARI, ruanganId: 1, noRuang: 1, disidang: 1, jamSidang: "10:19:04" },
      { perkaraId: "611", tanggalSidang: HARI, ruanganId: 2, noRuang: 2, disidang: 10, jamSidang: "09:40:00" },
      { perkaraId: "613", tanggalSidang: HARI, ruanganId: 1, noRuang: 1, disidang: null, jamSidang: "09:00:00" },
    ];
    const kueriRuangTunggu = async (sql: string, params: unknown[] = []) => {
      const s = sql.replace(/\s+/g, " ");
      if (!/^SELECT/.test(s.trim())) return { affectedRows: 0 };
      if (s.includes("disidang = ruangan_id AND disidang BETWEEN 1 AND 9")) {
        return tabel.filter((b) => b.disidang !== null && b.disidang === b.ruanganId && b.disidang >= 1 && b.disidang <= 9);
      }
      if (s.includes("AND disidang = ?")) return tabel.filter((b) => b.disidang === params[params.length - 1]);
      return [];
    };
    const L = selesaiMod.buatLayanan({
      kueriBot: async () => [],
      kueriSipp: async () => [],
      kueriRuangTunggu,
      setelAntrian: async () => ({ ok: true }),
    });
    const hasil = (await (L.petaSelesai as (x: unknown) => Promise<unknown>)({ dari: HARI, sampai: HARI })) as {
      peta: Record<string, { sumber: string[] }>;
      berjalan: { proses: Array<{ perkaraId: string; noRuang: number; sejak: string }> };
    };
    expect(hasil.berjalan.proses).toEqual([{ perkaraId: "609", tanggalSidang: HARI, noRuang: 1, sejak: `${HARI} 10:19:04` }]);
    expect(hasil.peta[`611|${HARI}`]?.sumber).toEqual(["antrian-ruang-tunggu"]);
    expect(hasil.peta[`609|${HARI}`]).toBeUndefined();
  });
});

// ============================================================================
// BOT - MEMANGGIL = MASUK RUANG, DIJALANKAN ATAS TABEL SUNGGUHAN (pg-mem)
// ============================================================================

function basisAntrian() {
  const db = newDb();
  db.public.registerFunction({ name: "curdate", args: [], returns: DataType.date, implementation: () => new Date(`${HARI}T00:00:00Z`) });
  db.createSchema("sipp_turunan_antrian");
  db.public.none(`
    CREATE TABLE sipp_turunan_antrian.antrian_sidang (
      perkara_id text, tanggal_sidang date, ruangan_id int, disidang int, jam_sidang timestamp
    );
    CREATE TABLE sipp_turunan_antrian.sys_data_refresh (id text, value timestamp);
    INSERT INTO sipp_turunan_antrian.sys_data_refresh VALUES ('sdng1', NULL), ('ruan1', NULL), ('lain', NULL);
  `);
  const literal = (v: unknown) =>
    v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
  const query = async (_kunci: string, sql: string, params: unknown[] = []) => {
    let i = 0;
    const jadi = sql.replace(/\?/g, () => literal(params[i++]));
    const hasil = db.public.query(jadi);
    return /^\s*SELECT/i.test(sql) ? hasil.rows : { affectedRows: hasil.rowCount };
  };
  const baca = (id: string) =>
    db.public.many(`SELECT disidang, jam_sidang FROM sipp_turunan_antrian.antrian_sidang WHERE perkara_id = '${id}'`)[0] as {
      disidang: number | null;
      jam_sidang: Date | null;
    };
  const tambah = (id: string, ruang: number | null, disidang: number | null) =>
    db.public.none(
      `INSERT INTO sipp_turunan_antrian.antrian_sidang VALUES ('${id}', '${HARI}', ${ruang ?? "NULL"}, ${disidang ?? "NULL"}, NULL)`
    );
  const segar = () =>
    db.public.many(`SELECT id FROM sipp_turunan_antrian.sys_data_refresh WHERE value IS NOT NULL ORDER BY id`).map((x) => (x as { id: string }).id);
  return { query, baca, tambah, segar };
}

type Panggil = (x: Record<string, unknown>) => Promise<{ ok: boolean; alasan?: string; urutan?: number }>;

function muatPanggilan(antrian: ReturnType<typeof basisAntrian>): Panggil {
  const pasang = (berkas: string, exports: unknown) => {
    const jalur = require_.resolve(path.join(AKAR, "aleta_bot/services", berkas));
    require_.cache[jalur] = { id: jalur, filename: jalur, loaded: true, exports } as unknown as NodeJS.Module;
  };
  const riwayat: Array<{ perkara_id: string; urutan: number }> = [];
  pasang("botDbService.js", {
    query: async (sql: string, params: unknown[] = []) => {
      if (/INSERT INTO aleta_bot_antrian_panggilan/.test(sql)) riwayat.push({ perkara_id: String(params[1]), urutan: Number(params[5]) });
      if (/FROM aleta_bot_antrian_panggilan/.test(sql)) {
        return riwayat.map((r) => ({ perkaraId: r.perkara_id, urutan: r.urutan, dipanggilPada: new Date(), oleh: "" }));
      }
      return [];
    },
    toMysqlDate: (d: Date) => d.toISOString(),
    fromMysqlDate: (d: unknown) => (d instanceof Date ? d : null),
  });
  pasang("externalDbService.js", { query: antrian.query, sanitizeError: (e: Error) => String(e?.message || e) });
  pasang("logService.js", { logSystemEvent: async () => true });
  const jalur = require_.resolve(path.join(AKAR, "aleta_bot/services/panggilanAntrianService.js"));
  delete require_.cache[jalur];
  return (require_(jalur) as { panggil: Panggil }).panggil;
}

describe("panggilanAntrianService.panggil = MASUK RUANG (dijalankan atas pg-mem)", () => {
  it("baris menunggu (NULL) menjadi disidang = ruangan_id, jam_sidang terisi, layar antrian disegarkan", async () => {
    const antrian = basisAntrian();
    antrian.tambah("609", 1, null);
    const panggil = muatPanggilan(antrian);
    const hasil = await panggil({ perkaraId: "609", oleh: "PP" });
    expect(hasil.ok).toBe(true);
    const b = antrian.baca("609");
    expect(b.disidang).toBe(1);
    expect(b.jam_sidang).not.toBeNull();
    expect(antrian.segar()).toEqual(["ruan1", "sdng1"]);
  });

  it("baris yang sudah SELESAI (10) tidak dikembalikan menjadi sedang disidang, dan panggilannya tidak dihitung", async () => {
    const antrian = basisAntrian();
    antrian.tambah("611", 2, 10);
    const panggil = muatPanggilan(antrian);
    const hasil = await panggil({ perkaraId: "611", oleh: "PP" });
    expect(hasil.ok).toBe(false);
    expect(hasil.alasan).toMatch(/SELESAI/);
    expect(antrian.baca("611").disidang).toBe(10);
    expect(antrian.segar()).toEqual([]);
  });

  it("panggilan ulang perkara yang sudah di ruangnya tetap di ruang itu (hitungan bertambah)", async () => {
    const antrian = basisAntrian();
    antrian.tambah("609", 3, null);
    const panggil = muatPanggilan(antrian);
    const satu = await panggil({ perkaraId: "609" });
    const dua = await panggil({ perkaraId: "609" });
    expect(satu.ok && dua.ok).toBe(true);
    expect(dua.urutan).toBe(2);
    expect(antrian.baca("609").disidang).toBe(3);
  });

  it("perkara tanpa ruang tidak diubah dan sebabnya disebut", async () => {
    const antrian = basisAntrian();
    antrian.tambah("700", null, null);
    const panggil = muatPanggilan(antrian);
    const hasil = await panggil({ perkaraId: "700" });
    expect(hasil.ok).toBe(false);
    expect(hasil.alasan).toMatch(/ruang sidang/);
    expect(antrian.baca("700").disidang).toBeNull();
  });
});
