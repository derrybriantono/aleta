// @vitest-environment node
/**
 * ============================================================================
 * TUNDA MEDIASI DI JADWAL MEDIASI - 26 OKT 2026
 * ============================================================================
 *
 * Tiga lapis, semuanya perilaku nyata (bukan membaca teks sumber):
 *   A. bot: tundaMediasiService dijalankan atas basis data tiruan yang SUNGGUH
 *      menyimpan baris - kueri yang dihasilkan, audit, transaksi, penolakan;
 *   B. aturan murni portal: lib/tunda-mediasi;
 *   C. rute portal: hak (golongan + kepemilikan perkara), hari libur, kering
 *      bawaan, penerusan ke bot.
 *
 * Bentuk tulisan dibandingkan dengan baris sys_audittrail dan perkara_jadwal_mediasi
 * SIPP satker yang diukur 26 Okt 2026 (penundaan 20 dan 22 Okt) dan dengan kode
 * SIPP (jadwal_mediasi_m::tunda_mediasi). Layar (jsdom) di tunda-mediasi-layar-26okt.test.tsx.
 */
import { createRequire } from "node:module";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const keadaan = vi.hoisted(() => ({
  aktor: null as Record<string, unknown> | null,
  bot: [] as Array<{ jalur: string; pilihan?: { method?: string; body?: Record<string, unknown> } }>,
  jawabanGet: {} as Record<string, unknown>,
  jawabanPost: { ok: true, kering: true } as Record<string, unknown>,
  kehadiran: { adaCatatan: false, baris: [] as unknown[] },
}));

vi.mock("@/server/db/client", () => ({
  getDatabase: async () => ({
    queryOne: async () => null,
    queryAll: async () => [],
    prepare: () => ({ all: async () => [], get: async () => null, run: async () => ({ changes: 0 }) }),
  }),
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/organization/service", () => ({
  requireActorUser: async () => {
    if (!keadaan.aktor) throw Object.assign(new Error("tanpa aktor"), { status: 401 });
    return keadaan.aktor;
  },
  getUserByIdFromDb: async () => keadaan.aktor,
  getUsersFromDb: async () => (keadaan.aktor ? [keadaan.aktor] : []),
}));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => keadaan.aktor }));
vi.mock("@/server/modules/aleta-ecourt/court-calendar-akun", () => ({ akunSippPengguna: async () => ({ milik: ["akun.sipp"] }) }));
vi.mock("@/server/modules/aleta-ecourt/kehadiran-mediasi", () => ({ bacaKehadiran: async () => keadaan.kehadiran }));
vi.mock("@/server/modules/aleta-ecourt/jadwal-sidang-gateway", () => ({
  panggilBotJadwalSidang: async (jalur: string, pilihan?: { method?: string; body?: Record<string, unknown> }) => {
    keadaan.bot.push({ jalur, pilihan });
    const menulis = pilihan?.method === "POST";
    return { ok: true, data: menulis ? keadaan.jawabanPost : keadaan.jawabanGet };
  },
}));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { NextResponse } = await import("next/server");
  return {
    handleAdminRouteError: (galat: { status?: number; message?: string }) =>
      NextResponse.json({ ok: false, error: { message: String(galat && galat.message) } }, { status: Number(galat && galat.status) || 500 }),
  };
});

import {
  ALASAN_TUNDA_MEDIASI,
  alasanTundaMediasi,
  barisSetelahTundaMediasi,
  bolehTundaMediasi,
  peringatanTenggangTunda,
  tanggalUsulanTundaMediasi,
  usulanKehadiranSipp,
} from "@/lib/tunda-mediasi";
import { AKSI, bolehAksi } from "@/lib/matriks-peran";
import type { UserPersona } from "@/lib/types";

// ============================================================================
// A. BOT
// ============================================================================

const AKAR = path.resolve(process.cwd(), "..");
const bot_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));
type Layanan = {
  keadaanTunda: (m: Record<string, unknown>) => Promise<Record<string, any>>;
  susunRencanaTunda: (m: Record<string, unknown>) => Promise<Record<string, any>>;
  jalankanRencanaTunda: (r: Record<string, any>, o?: Record<string, unknown>) => Promise<Record<string, any>>;
};
const modulTunda = bot_(path.join(AKAR, "aleta_bot/services/tundaMediasiService.js")) as {
  buatLayanan: (deps: Record<string, unknown>) => Layanan;
  DAFTAR_TABEL_TUNDA_MEDIASI: Set<string>;
  pesanTolak: (kode: string, h?: Record<string, unknown>) => string;
};

type Jadwal = {
  id: number;
  mediasi_id: number;
  urutan: number;
  tanggal_mediasi: string;
  jam_mediasi: string | null;
  sampai_jam: string | null;
  tempat: string | null;
  dihadiri_oleh: string | null;
  ditunda: string;
  diperbaharui_oleh?: string;
  diperbaharui_tanggal?: string;
  diinput_oleh?: string;
  diinput_tanggal?: string;
};

function dasarMediasi(ubah: Partial<{ laporan: string; sidangPertama: string; jadwal: Jadwal[] }> = {}) {
  return {
    mediasi: {
      mediasiId: 795,
      perkaraId: 10200,
      nomorPerkara: "123/Pdt.G/2026/PA.Dgl",
      alurPerkaraId: 15,
      mediator: "Fahri, S.H.I.",
      mediatorId: "12",
      penetapan: "2026-10-08",
      laporan: ubah.laporan ?? "",
      sidangPertama: ubah.sidangPertama ?? "2026-10-07",
    },
    jadwal:
      ubah.jadwal ??
      ([
        { id: 1320, mediasi_id: 795, urutan: 1, tanggal_mediasi: "2026-10-22", jam_mediasi: "09:00", sampai_jam: "10:00", tempat: "Ruang Mediasi PA", dihadiri_oleh: "1", ditunda: "T" },
      ] as Jadwal[]),
  };
}

/** Basis data tiruan yang SUNGGUH menyimpan baris dan membatalkan bila transaksi gagal. */
function bdTiruan(awal = dasarMediasi(), opsi: { gagalPadaAudit?: boolean; paniteraGalat?: boolean; tanpaMediator?: boolean } = {}) {
  let jadwal: Jadwal[] = awal.jadwal.map((j) => ({ ...j }));
  const audit: Array<Record<string, unknown>> = [];
  const ditulis: Array<{ sql: string; params: unknown[] }> = [];
  const dibaca: string[] = [];
  let urusanTransaksi = 0;

  const kueri = async (teks: string, params: unknown[] = []): Promise<any> => {
    const sql = teks.replace(/\s+/g, " ").trim();
    if (/^(UPDATE|INSERT|DELETE)/i.test(sql)) {
      ditulis.push({ sql, params });
      if (/^INSERT INTO sys_audittrail/.test(sql)) {
        if (opsi.gagalPadaAudit && audit.length === 1) throw new Error("audit gagal");
        audit.push({
          datetime: params[0],
          ipaddress: params[1],
          username: params[2],
          tablename: params[3],
          formname: params[4],
          action: params[5],
          title: params[6],
          description: params[7],
        });
        return { affectedRows: 1 };
      }
      if (/^UPDATE perkara_jadwal_mediasi SET tempat = \?, ditunda = \?/.test(sql)) {
        for (const j of jadwal.filter((x) => x.mediasi_id === params[4])) {
          j.tempat = String(params[0]);
          j.ditunda = String(params[1]);
          j.diperbaharui_oleh = String(params[2]);
          j.diperbaharui_tanggal = String(params[3]);
        }
        return { affectedRows: 1 };
      }
      if (/^UPDATE perkara_jadwal_mediasi SET dihadiri_oleh/.test(sql)) {
        const j = jadwal.find((x) => x.id === params[3]);
        if (j) {
          j.dihadiri_oleh = String(params[0]);
          j.diperbaharui_oleh = String(params[1]);
          j.diperbaharui_tanggal = String(params[2]);
        }
        return { affectedRows: 1 };
      }
      if (/^UPDATE perkara_jadwal_mediasi SET jam_mediasi/.test(sql)) {
        const j = jadwal.find((x) => x.id === params[4]);
        if (j) {
          j.jam_mediasi = String(params[0]);
          j.sampai_jam = params[1] === null ? null : String(params[1]);
          j.diperbaharui_oleh = String(params[2]);
          j.diperbaharui_tanggal = String(params[3]);
        }
        return { affectedRows: 1 };
      }
      if (/^INSERT INTO perkara_jadwal_mediasi/.test(sql)) {
        const kolom = /\(([^)]+)\)/.exec(sql)![1].split(",").map((x) => x.trim());
        const baris: Record<string, unknown> = { ditunda: "T", jam_mediasi: null, sampai_jam: null, dihadiri_oleh: null };
        kolom.forEach((k, i) => (baris[k] = params[i]));
        jadwal.push(baris as unknown as Jadwal);
        return { insertId: 1 };
      }
      throw new Error(`tulisan tak dikenal: ${sql}`);
    }
    dibaca.push(sql);
    if (/FROM perkara_mediasi m JOIN perkara p/.test(sql)) {
      return params[0] === awal.mediasi.mediasiId ? [awal.mediasi] : [];
    }
    if (/FROM perkara_jadwal_mediasi WHERE mediasi_id = \? ORDER BY urutan ASC, id ASC FOR UPDATE/.test(sql)) {
      return jadwal
        .filter((j) => j.mediasi_id === params[0])
        .sort((a, b) => a.urutan - b.urutan)
        .map((j) => ({ id: j.id, urutan: j.urutan, ditunda: j.ditunda }));
    }
    if (/FROM perkara_jadwal_mediasi WHERE mediasi_id = \?/.test(sql)) {
      return jadwal
        .filter((j) => j.mediasi_id === params[0])
        .sort((a, b) => a.urutan - b.urutan)
        .map((j) => ({
          id: j.id,
          urutan: j.urutan,
          tanggal: j.tanggal_mediasi,
          jam: j.jam_mediasi,
          sampaiJam: j.sampai_jam,
          tempat: j.tempat,
          dihadiriOleh: j.dihadiri_oleh,
          ditunda: j.ditunda,
        }));
    }
    if (/SELECT COALESCE\(MAX\(id\),0\)\+1 AS n FROM perkara_jadwal_mediasi/.test(sql)) {
      return [{ n: Math.max(0, ...jadwal.map((j) => Number(j.id))) + 1 }];
    }
    if (/FROM perkara_hakim_pn a JOIN v_users b/.test(sql)) return [{ username: "idris", fullname: "Idris, S.H." }];
    if (/FROM mediator md/.test(sql)) return opsi.tanpaMediator ? [] : [{ username: "fahri", fullname: "Fahri, S.H.I." }];
    if (/hakim_nama AS nama FROM perkara_hakim_pn/.test(sql)) return [{ nama: "Idris, S.H." }, { nama: "Sudarmin, S.H." }];
    if (/panitera_nama AS nama FROM perkara_panitera_pn/.test(sql)) return [{ nama: "Andini, S.H." }];
    return [];
  };

  const transaksi = async (kerja: (k: typeof kueri) => Promise<any>) => {
    urusanTransaksi += 1;
    const salinan = jadwal.map((j) => ({ ...j }));
    const auditSalinan = audit.slice();
    try {
      return await kerja(kueri);
    } catch (galat) {
      jadwal = salinan;
      audit.length = 0;
      audit.push(...auditSalinan);
      (galat as { dipulihkan?: boolean }).dipulihkan = true;
      throw galat;
    }
  };

  const layanan = modulTunda.buatLayanan({
    kueri,
    transaksi,
    waktu: async () => "2026-10-26 14:05:09",
    paniteraSidang: async () =>
      opsi.paniteraGalat
        ? { ok: false, alasan: "panitera_sidang_ganda", nama: ["A", "B"] }
        : { ok: true, akun: { username: "andini", fullname: "Andini, S.H." } },
  });
  return { layanan, kueri, jadwal: () => jadwal, audit, ditulis, dibaca, transaksiDipakai: () => urusanTransaksi };
}

const MINTA = {
  mediasiId: "795",
  tanggal: "2026-10-22",
  tanggalBaru: "2026-11-05",
  tempat: "Kantor KUA Labuan",
  alasan: "Salah satu pihak tidak hadir",
  operator: "usr_uji",
  ip: "192.168.10.55",
};

describe("A1. bot: keadaan pertemuan", () => {
  it("pertemuan terakhir yang kehadirannya sudah terisi boleh ditunda; akun dan tenggang terbaca", async () => {
    const bd = bdTiruan();
    const k = await bd.layanan.keadaanTunda({ mediasiId: "795", tanggal: "2026-10-22" });
    expect(k).toMatchObject({ ok: true, boleh: true, perluKehadiran: false, jumlahPertemuan: 1, tenggat: "2026-11-07" });
    expect(k.pertemuan).toMatchObject({ id: 1320, urutan: 1, tanggal: "2026-10-22", kehadiran: "Semua pihak" });
    expect(k.akun.panitera).toMatchObject({ username: "andini" });
    expect(k.akun.mediator).toMatchObject({ username: "fahri" });
    expect(k.akun.hakim).toMatchObject({ username: "idris" });
    expect(k.majelis).toEqual(["Idris, S.H.", "Sudarmin, S.H."]);
    expect(k.panitera).toEqual(["Andini, S.H."]);
    // hanya membaca
    expect(bd.ditulis).toHaveLength(0);
  });

  it("kehadiran belum diisi: boleh (diisi dari formulir) bila pertemuan sudah tiba; belum tiba = ditolak", async () => {
    const tanpaHadir = dasarMediasi({ jadwal: [{ id: 1320, mediasi_id: 795, urutan: 1, tanggal_mediasi: "2026-10-22", jam_mediasi: "09:00", sampai_jam: null, tempat: "Ruang", dihadiri_oleh: null, ditunda: "T" }] });
    const k = await bdTiruan(tanpaHadir).layanan.keadaanTunda({ mediasiId: "795", tanggal: "2026-10-22" });
    expect(k).toMatchObject({ boleh: true, perluKehadiran: true });

    const nanti = dasarMediasi({ jadwal: [{ id: 1320, mediasi_id: 795, urutan: 1, tanggal_mediasi: "2026-10-30", jam_mediasi: null, sampai_jam: null, tempat: "Ruang", dihadiri_oleh: null, ditunda: "T" }] });
    const kn = await bdTiruan(nanti).layanan.keadaanTunda({ mediasiId: "795", tanggal: "2026-10-30" });
    expect(kn).toMatchObject({ boleh: false, kodeTolak: "pertemuan_belum_tiba" });
    expect(kn.sebabTolak).toMatch(/belum berlangsung/);
  });

  it("bukan pertemuan terakhir, sudah ditunda, atau laporan mediator sudah masuk = ditolak dengan sebab", async () => {
    const dua = dasarMediasi({
      jadwal: [
        { id: 1, mediasi_id: 795, urutan: 1, tanggal_mediasi: "2026-10-15", jam_mediasi: null, sampai_jam: null, tempat: "R", dihadiri_oleh: "1", ditunda: "Y" },
        { id: 2, mediasi_id: 795, urutan: 2, tanggal_mediasi: "2026-10-22", jam_mediasi: null, sampai_jam: null, tempat: "R", dihadiri_oleh: "1", ditunda: "T" },
      ],
    });
    const bd = bdTiruan(dua);
    expect(await bd.layanan.keadaanTunda({ mediasiId: "795", tanggal: "2026-10-15" })).toMatchObject({ boleh: false, kodeTolak: "bukan_pertemuan_terakhir" });
    expect(await bd.layanan.keadaanTunda({ mediasiId: "795", tanggal: "2026-10-22" })).toMatchObject({ boleh: true, jumlahPertemuan: 2 });

    const selesai = bdTiruan(dasarMediasi({ laporan: "2026-10-23" }));
    expect(await selesai.layanan.keadaanTunda({ mediasiId: "795", tanggal: "2026-10-22" })).toMatchObject({ boleh: false, kodeTolak: "mediasi_selesai" });

    const kosong = await bd.layanan.keadaanTunda({ mediasiId: "999", tanggal: "2026-10-22" });
    expect(kosong).toMatchObject({ ok: false, alasan: "pertemuan_tidak_ketemu" });
  });
});

describe("A2. bot: tulisan PERSIS SIPP (jadwal_mediasi_m::tunda_mediasi)", () => {
  it("kering bawaan: rencana dipulangkan, tidak satu baris pun ditulis", async () => {
    const bd = bdTiruan();
    const rencana = await bd.layanan.susunRencanaTunda(MINTA);
    expect(rencana.ok).toBe(true);
    const kering = await bd.layanan.jalankanRencanaTunda(rencana);
    expect(kering).toMatchObject({ ok: true, kering: true, jumlahLangkah: 4 });
    expect(bd.ditulis).toHaveLength(0);
    expect(bd.transaksiDipakai()).toBe(0);
  });

  it("kering:false: UPDATE seluruh pertemuan mediasi itu, INSERT pertemuan berikutnya, dua baris audit - dalam SATU transaksi", async () => {
    const bd = bdTiruan();
    const rencana = await bd.layanan.susunRencanaTunda(MINTA);
    const hasil = await bd.layanan.jalankanRencanaTunda(rencana, { kering: false });
    expect(hasil).toMatchObject({ ok: true, kering: false, jumlahLangkah: 4, jadwalBaruId: 1321 });
    expect(bd.transaksiDipakai()).toBe(1);

    // Urutan tulisan = urutan SIPP: UPDATE, audit, INSERT, audit.
    expect(bd.ditulis.map((t) => t.sql.split(" ").slice(0, 3).join(" "))).toEqual([
      "UPDATE perkara_jadwal_mediasi SET",
      "INSERT INTO sys_audittrail",
      "INSERT INTO perkara_jadwal_mediasi",
      "INSERT INTO sys_audittrail",
    ]);
    // WHERE mediasi_id (semua pertemuan), bukan id satu baris - persis SIPP.
    expect(bd.ditulis[0].sql).toContain("WHERE mediasi_id = ?");

    const [lama, baru] = bd.jadwal();
    expect(lama).toMatchObject({ id: 1320, ditunda: "Y", tempat: "Ruang Mediasi PA", diperbaharui_oleh: "andini", diperbaharui_tanggal: "2026-10-26 02:05:09" });
    expect(baru).toMatchObject({
      id: 1321,
      mediasi_id: 795,
      urutan: 2,
      tanggal_mediasi: "2026-11-05",
      tempat: "Kantor KUA Labuan",
      diinput_oleh: "andini",
      diinput_tanggal: "2026-10-26 02:05:09",
      ditunda: "T",
      jam_mediasi: null,
      dihadiri_oleh: null,
    });
  });

  it("audit trail: tablename, formname, judul, dan tabel deskripsi sama dengan baris SIPP asli (20/22 Okt 2026)", async () => {
    const bd = bdTiruan();
    const rencana = await bd.layanan.susunRencanaTunda(MINTA);
    await bd.layanan.jalankanRencanaTunda(rencana, { kering: false });
    const [ubah, tambah] = bd.audit;

    expect(ubah).toMatchObject({
      datetime: "2026-10-26 14:05:09",
      ipaddress: "192.168.10.55",
      username: "andini",
      tablename: "perkara_jadwal_mediasi",
      formname: "Add Mediasi",
      action: "UPDATE",
      // SIPP menaruh mediasi_id pada Primary Key judul UPDATE.
      title: "UPDATE Jadwal Mediasi <br /> UPDATE table <b>perkara_jadwal_mediasi</b> dari halaman <b>PENUNDAAN JADWAL MEDIASI</b> dengan Primary Key [id=795]",
    });
    expect(ubah.description).toBe(
      '<br><table style="vertical-align:top" cellspacing="0" cellpadding="1" border="1"><tr><th>Nama Kolom</th><th>Nilai</th></tr>' +
        "<tr><td>tempat</td><td>Ruang Mediasi PA</td></tr><tr><td>ditunda</td><td>Y</td></tr>" +
        "<tr><td>diperbaharui_oleh</td><td>andini</td></tr><tr><td>diperbaharui_tanggal</td><td>2026-10-26 02:05:09</td></tr></table>"
    );

    expect(tambah).toMatchObject({
      action: "INSERT",
      tablename: "perkara_jadwal_mediasi",
      formname: "Add Mediasi",
      title: "INSERT Jadwal Mediasi <br /> INSERT table <b>perkara_jadwal_mediasi</b> dari halaman <b>PENUNDAAN JADWAL MEDIASI</b> dengan Primary Key [id=1321]",
    });
    expect(tambah.description).toBe(
      '<br><table style="vertical-align:top" cellspacing="0" cellpadding="1" border="1"><tr><th>Nama Kolom</th><th>Nilai</th></tr>' +
        "<tr><td>id</td><td>1321</td></tr><tr><td>mediasi_id</td><td>795</td></tr><tr><td>urutan</td><td>2</td></tr>" +
        "<tr><td>tanggal_mediasi</td><td>2026-11-05</td></tr><tr><td>tempat</td><td>Kantor KUA Labuan</td></tr>" +
        "<tr><td>diinput_oleh</td><td>andini</td></tr><tr><td>diinput_tanggal</td><td>2026-10-26 02:05:09</td></tr></table>"
    );
  });

  it("tidak satu kata ALETA sampai ke SIPP: seluruh tulisan bersih, alasan/keterangan tidak ikut ditulis", async () => {
    const bd = bdTiruan();
    const rencana = await bd.layanan.susunRencanaTunda({ ...MINTA, alasan: "Atas arahan majelis", keterangan: "dicatat lewat portal" });
    await bd.layanan.jalankanRencanaTunda(rencana, { kering: false });
    const semua = JSON.stringify([bd.ditulis, bd.audit]);
    expect(semua).not.toMatch(/aleta/i);
    // Alasan hanya di rencana (untuk riwayat ALETA), tidak di satu pun parameter SIPP.
    expect(rencana.alasanTunda).toBe("Atas arahan majelis");
    expect(semua).not.toContain("Atas arahan majelis");

    // Kata ALETA pada tempat (ketikan manusia) DITAHAN, bukan dibersihkan diam-diam.
    const tahan = await bdTiruan().layanan.susunRencanaTunda({ ...MINTA, tempat: "Ruang A L E T A" });
    expect(tahan).toMatchObject({ ok: false, alasan: "teks_menyebut_aleta" });
    expect(tahan.pesan).toMatch(/ALETA/);
  });

  it("jam pertemuan berikutnya (opsional) = langkah Edit SIPP pada baris baru, tanpa audit tambahan", async () => {
    const bd = bdTiruan();
    const rencana = await bd.layanan.susunRencanaTunda({ ...MINTA, jam: "09:30", sampaiJam: "10:30" });
    expect(rencana.langkah).toHaveLength(5);
    const hasil = await bd.layanan.jalankanRencanaTunda(rencana, { kering: false });
    expect(hasil.ok).toBe(true);
    expect(bd.audit).toHaveLength(2);
    expect(bd.jadwal()[1]).toMatchObject({ id: 1321, jam_mediasi: "09:30", sampai_jam: "10:30", diperbaharui_oleh: "andini" });
  });

  it("kehadiran belum diisi: wajib dipilih, lalu ditulis ke pertemuan lama (Edit SIPP, tanpa audit) sebelum Tunda", async () => {
    const tanpaHadir = dasarMediasi({ jadwal: [{ id: 1320, mediasi_id: 795, urutan: 1, tanggal_mediasi: "2026-10-22", jam_mediasi: "09:00", sampai_jam: null, tempat: "Ruang", dihadiri_oleh: null, ditunda: "T" }] });
    const bd = bdTiruan(tanpaHadir);
    expect(await bd.layanan.susunRencanaTunda(MINTA)).toMatchObject({ ok: false, alasan: "kehadiran_belum_diisi" });
    expect(await bd.layanan.susunRencanaTunda({ ...MINTA, kehadiran: "9" })).toMatchObject({ ok: false, alasan: "kehadiran_tidak_sah" });

    const rencana = await bd.layanan.susunRencanaTunda({ ...MINTA, kehadiran: "2" });
    expect(rencana.ok).toBe(true);
    expect(rencana.langkah[0].sql).toMatch(/^UPDATE perkara_jadwal_mediasi SET dihadiri_oleh/);
    await bd.layanan.jalankanRencanaTunda(rencana, { kering: false });
    expect(bd.jadwal()[0]).toMatchObject({ dihadiri_oleh: "2", ditunda: "Y" });
    expect(bd.audit).toHaveLength(2); // Edit SIPP tidak menulis audit
  });

  it("aturan validateTunda SIPP: tempat wajib, tanggal sesudah pertemuan lama, bukan Sabtu/Minggu, sidang pertama ada", async () => {
    const bd = bdTiruan();
    const coba = (u: Record<string, unknown>) => bd.layanan.susunRencanaTunda({ ...MINTA, ...u });
    expect(await coba({ tempat: "  " })).toMatchObject({ alasan: "tempat_kosong" });
    expect(await coba({ tempat: "x".repeat(501) })).toMatchObject({ alasan: "tempat_terlalu_panjang" });
    expect(await coba({ tanggalBaru: "" })).toMatchObject({ alasan: "tanggal_berikut_tidak_sah" });
    expect(await coba({ tanggalBaru: "2026-10-22" })).toMatchObject({ alasan: "tanggal_berikut_tidak_maju" });
    expect(await coba({ tanggalBaru: "2026-10-20" })).toMatchObject({ alasan: "tanggal_berikut_tidak_maju" });
    expect(await coba({ tanggalBaru: "2026-11-07" })).toMatchObject({ alasan: "tanggal_berikut_akhir_pekan" }); // Sabtu
    expect(await coba({ tanggalBaru: "2026-11-08" })).toMatchObject({ alasan: "tanggal_berikut_akhir_pekan" }); // Minggu
    expect(await coba({ jam: "25:00" })).toMatchObject({ alasan: "jam_tidak_sah" });
    expect(await coba({ jam: "10:00", sampaiJam: "09:00" })).toMatchObject({ alasan: "jam_selesai_tidak_sah" });
    expect(await coba({ operator: "" })).toMatchObject({ alasan: "operator_tidak_disebut" });
    expect(await bdTiruan(dasarMediasi({ sidangPertama: "" })).layanan.susunRencanaTunda(MINTA)).toMatchObject({ alasan: "sidang_pertama_tidak_ada" });
    // semuanya ditolak SEBELUM menulis
    expect(bd.ditulis).toHaveLength(0);
  });

  it("melewati tenggang 30 hari: tetap dapat dicatat, dengan peringatan", async () => {
    const bd = bdTiruan();
    const lewat = await bd.layanan.susunRencanaTunda({ ...MINTA, tanggalBaru: "2026-11-12" });
    expect(lewat.ok).toBe(true);
    expect(lewat.tenggat).toBe("2026-11-07");
    expect(lewat.peringatan[0]).toMatch(/melewati batas tenggang mediasi 30 hari/);
    const dalam = await bd.layanan.susunRencanaTunda({ ...MINTA, tanggalBaru: "2026-11-05" });
    expect(dalam.peringatan).toEqual([]);
  });

  it("akun: bawaan panitera pengganti; mediator/ketua majelis dapat dipilih; tanpa akun = ditolak tanpa menebak", async () => {
    const bd = bdTiruan();
    expect((await bd.layanan.susunRencanaTunda(MINTA)).atasNama).toMatchObject({ username: "andini", sebagai: "panitera" });
    expect((await bd.layanan.susunRencanaTunda({ ...MINTA, atasNama: "mediator" })).atasNama).toMatchObject({ username: "fahri", sebagai: "mediator" });
    expect((await bd.layanan.susunRencanaTunda({ ...MINTA, atasNama: "hakim" })).atasNama).toMatchObject({ username: "idris", sebagai: "hakim" });

    const ganda = await bdTiruan(dasarMediasi(), { paniteraGalat: true }).layanan.susunRencanaTunda(MINTA);
    expect(ganda).toMatchObject({ ok: false, alasan: "akun_tidak_tersedia" });
    expect(ganda.pesan).toMatch(/lebih dari satu panitera/);

    const tanpaMed = await bdTiruan(dasarMediasi(), { tanpaMediator: true }).layanan.susunRencanaTunda({ ...MINTA, atasNama: "mediator" });
    expect(tanpaMed).toMatchObject({ ok: false, alasan: "akun_tidak_tersedia" });
  });

  it("dua penekan bersamaan: penekan kedua ditolak di dalam transaksi, tidak ada baris ganda", async () => {
    const bd = bdTiruan();
    const rencana = await bd.layanan.susunRencanaTunda(MINTA);
    const pertama = await bd.layanan.jalankanRencanaTunda(rencana, { kering: false });
    expect(pertama.ok).toBe(true);
    const kedua = await bd.layanan.jalankanRencanaTunda(rencana, { kering: false });
    expect(kedua).toMatchObject({ ok: false, alasan: "pertemuan_berubah" });
    expect(bd.jadwal()).toHaveLength(2);
    expect(bd.audit).toHaveLength(2);
  });

  it("gagal di tengah (audit kedua gagal): ROLLBACK utuh - pertemuan lama tidak bertanda, tidak ada pertemuan baru", async () => {
    const bd = bdTiruan(dasarMediasi(), { gagalPadaAudit: true });
    const rencana = await bd.layanan.susunRencanaTunda(MINTA);
    const hasil = await bd.layanan.jalankanRencanaTunda(rencana, { kering: false });
    expect(hasil).toMatchObject({ ok: false, alasan: "gagal_menulis", dipulihkan: true });
    expect(hasil.pada).toMatchObject({ tabel: "sys_audittrail" });
    expect(hasil.dibatalkan.length).toBeGreaterThan(0);
    expect(bd.jadwal()).toHaveLength(1);
    expect(bd.jadwal()[0].ditunda).toBe("T");
    expect(bd.audit).toHaveLength(0);
  });

  it("daftar putih tabel: rencana yang menyentuh tabel lain ditolak sebelum menulis", async () => {
    const bd = bdTiruan();
    const rencana = await bd.layanan.susunRencanaTunda(MINTA);
    rencana.langkah.push({ tabel: "perkara", aksi: "UPDATE", sql: "UPDATE perkara SET x = ?", params: [1], keterangan: "bukan haknya" });
    const hasil = await bd.layanan.jalankanRencanaTunda(rencana, { kering: false });
    expect(hasil).toMatchObject({ ok: false, alasan: "tabel_di_luar_daftar", tabel: "perkara" });
    expect(bd.ditulis).toHaveLength(0);
    expect([...modulTunda.DAFTAR_TABEL_TUNDA_MEDIASI].sort()).toEqual(["perkara_jadwal_mediasi", "sys_audittrail"]);
  });

  it("tidak pernah menghapus baris SIPP", async () => {
    const bd = bdTiruan();
    const rencana = await bd.layanan.susunRencanaTunda({ ...MINTA, jam: "09:00" });
    await bd.layanan.jalankanRencanaTunda(rencana, { kering: false });
    expect(bd.ditulis.some((t) => /^DELETE/i.test(t.sql))).toBe(false);
  });
});

// ============================================================================
// B. ATURAN MURNI PORTAL
// ============================================================================

function akun(roleId: string, positionId = "", additionalRoleIds: string[] = [], name = `Uji ${roleId}`): UserPersona {
  return {
    id: `usr-${roleId}-${positionId}-${additionalRoleIds.join("+")}`,
    username: roleId,
    password: "",
    name,
    email: `${roleId}@uji.lokal`,
    roleId,
    positionId,
    additionalRoleIds,
    isActive: true,
  } as unknown as UserPersona;
}

const PETUGAS = { mediator: "Fahri, S.H.I.", majelis: ["Idris, S.H.", "Sudarmin, S.H."], panitera: ["Andini, S.H."] };

describe("B. aturan murni: lib/tunda-mediasi", () => {
  it("aksi mediasi.tunda: golongan sama dengan mencatat mediasi; kasir, jurusita, PTSP tidak", () => {
    expect(AKSI["mediasi.tunda"].rute).toEqual(["POST /api/aleta-ecourt/tunda-mediasi"]);
    const boleh = (a: UserPersona) => bolehAksi(a, "mediasi.tunda");
    expect(boleh(akun("super-admin", "pos-pranata-komputer"))).toBe(true);
    expect(boleh(akun("admin", "pos-pranata-komputer"))).toBe(true);
    expect(boleh(akun("hakim", "pos-hakim"))).toBe(true);
    expect(boleh(akun("panitera-pengganti", "pos-panitera-pengganti"))).toBe(true);
    expect(boleh(akun("pelaksana", "pos-staf-umum", ["mediator"]))).toBe(true);
    expect(boleh(akun("pelaksana", "pos-staf-umum", ["kasir"]))).toBe(false);
    expect(boleh(akun("jurusita", "pos-jurusita"))).toBe(false);
    expect(boleh(akun("pelaksana", "pos-ptsp", ["petugas_ptsp"]))).toBe(false);
  });

  it("kepemilikan: hakim/PP/mediator hanya perkara yang namanya tercatat; pimpinan/panitera/Admin selalu", () => {
    const hakimIni = akun("hakim", "pos-hakim", [], "Idris");
    const hakimLain = akun("hakim", "pos-hakim", [], "Rahman");
    const ppIni = akun("panitera-pengganti", "pos-panitera-pengganti", [], "Andini");
    const ppLain = akun("panitera-pengganti", "pos-panitera-pengganti", [], "Sitti");
    const mediatorIni = akun("hakim", "pos-hakim", ["mediator"], "Fahri");
    expect(bolehTundaMediasi(hakimIni, PETUGAS)).toBe(true);
    expect(bolehTundaMediasi(hakimLain, PETUGAS)).toBe(false);
    expect(bolehTundaMediasi(ppIni, PETUGAS)).toBe(true);
    expect(bolehTundaMediasi(ppLain, PETUGAS)).toBe(false);
    expect(bolehTundaMediasi(mediatorIni, PETUGAS)).toBe(true);
    expect(bolehTundaMediasi(akun("panitera", "pos-panitera", [], "Siapa Saja"), PETUGAS)).toBe(true);
    expect(bolehTundaMediasi(akun("panitera-muda", "pos-panitera-muda-gugatan", [], "Siapa Saja"), PETUGAS)).toBe(true);
    expect(bolehTundaMediasi(akun("ketua", "pos-ketua", [], "Siapa Saja"), PETUGAS)).toBe(true);
    expect(bolehTundaMediasi(akun("admin", "pos-pranata-komputer", [], "Siapa Saja"), PETUGAS)).toBe(true);
    expect(bolehTundaMediasi(akun("super-admin", "pos-pranata-komputer", [], "Siapa Saja"), PETUGAS)).toBe(true);
    expect(bolehTundaMediasi(null, PETUGAS)).toBe(false);
    // dua mediator dalam satu teks
    expect(bolehTundaMediasi(mediatorIni, { ...PETUGAS, mediator: "Rahman, S.H.<br />Fahri, S.H.I." })).toBe(true);
  });

  it("usulan kehadiran dari catatan ALETA; catatan kosong/ belum lengkap tidak ditebak", () => {
    const baris = (h: Record<string, boolean>) =>
      ["penggugat", "kuasa_penggugat", "tergugat", "kuasa_tergugat"].map((k) => ({ kedudukan: k, hadir: Boolean(h[k]), belumDicatat: false }));
    expect(usulanKehadiranSipp(baris({ penggugat: true, tergugat: true }))).toBe("1");
    expect(usulanKehadiranSipp(baris({ kuasa_penggugat: true, kuasa_tergugat: true }))).toBe("1");
    expect(usulanKehadiranSipp(baris({ penggugat: true }))).toBe("2");
    expect(usulanKehadiranSipp(baris({ tergugat: true }))).toBe("3");
    expect(usulanKehadiranSipp(baris({}))).toBe("4");
    expect(usulanKehadiranSipp(baris({}).map((b) => ({ ...b, belumDicatat: true })))).toBe("");
    expect(usulanKehadiranSipp([])).toBe("");
  });

  it("usulan tanggal: dua pekan, tidak sebelum besok, akhir pekan digeser ke Senin", () => {
    expect(tanggalUsulanTundaMediasi("2026-10-22", "2026-10-26")).toBe("2026-11-05"); // Kamis
    expect(tanggalUsulanTundaMediasi("2026-10-12", "2026-10-26")).toBe("2026-10-27"); // sudah lewat: besok (Selasa)
    expect(tanggalUsulanTundaMediasi("2026-10-24", "2026-10-26")).toBe("2026-11-09"); // 07 Nov Sabtu -> Senin 09
    expect(tanggalUsulanTundaMediasi("2026-10-25", "2026-10-26")).toBe("2026-11-09"); // 08 Nov Minggu -> Senin
  });

  it("peringatan tenggang hanya bila tanggal melewati batas", () => {
    expect(peringatanTenggangTunda("2026-11-07", "2026-11-07")).toBe("");
    expect(peringatanTenggangTunda("2026-11-09", "2026-11-07")).toMatch(/2026-11-07/);
    expect(peringatanTenggangTunda("2026-11-09", "")).toBe("");
  });

  it("alasan: pilihan lazim, tambahan, atau ketikan sendiri", () => {
    expect(ALASAN_TUNDA_MEDIASI.length).toBeGreaterThanOrEqual(8);
    expect(alasanTundaMediasi("kedua-pihak-tidak-hadir", "")).toBe("Kedua pihak tidak hadir");
    expect(alasanTundaMediasi("kedua-pihak-tidak-hadir", "sedang sakit")).toBe("Kedua pihak tidak hadir - sedang sakit");
    expect(alasanTundaMediasi("lainnya", " Hakim mediator dinas luar ")).toBe("Hakim mediator dinas luar");
    expect(alasanTundaMediasi("", "")).toBe("");
  });

  it("baris daftar sesudah tunda: semua pertemuan mediasi itu bertanda ditunda; pertemuan baru muncul hanya di rentang tampil", () => {
    const dasar = { mediasiId: "795", tanggal: "2026-10-22", jam: "09:00", sampaiJam: "", tempat: "Ruang", dihadiri: "", ditunda: false };
    const lain = { ...dasar, mediasiId: "800", tanggal: "2026-10-22", jam: "10:00" };
    const akhir = { ...dasar, mediasiId: "801", tanggal: "2026-11-10", jam: "08:00" };
    const baru = { tanggal: "2026-11-05", tempat: "KUA", jam: "09:30", sampaiJam: "10:30" };

    const dalam = barisSetelahTundaMediasi([dasar, lain, akhir], { mediasiId: "795", tanggal: "2026-10-22" }, baru, "1", { dari: "2026-10-01", sampai: "2026-11-30" });
    expect(dalam).toHaveLength(4);
    expect(dalam[0]).toMatchObject({ mediasiId: "795", ditunda: true, dihadiri: "1" });
    expect(dalam[1]).toMatchObject({ mediasiId: "800", ditunda: false }); // mediasi lain tidak tersentuh
    // disisipkan sebelum baris pertama yang tanggalnya lebih lambat; urutan bot dijaga
    expect(dalam.map((x) => `${x.mediasiId}@${x.tanggal}`)).toEqual(["795@2026-10-22", "800@2026-10-22", "795@2026-11-05", "801@2026-11-10"]);
    expect(dalam[2]).toMatchObject({ ditunda: false, tempat: "KUA", jam: "09:30", sampaiJam: "10:30", dihadiri: "" });

    const luar = barisSetelahTundaMediasi([dasar], { mediasiId: "795", tanggal: "2026-10-22" }, baru, "", { dari: "2026-10-22", sampai: "2026-10-22" });
    expect(luar).toHaveLength(1);
    expect(luar[0].ditunda).toBe(true);
  });
});

// ============================================================================
// C. RUTE PORTAL
// ============================================================================

const permintaan = (url: string, method = "GET", body: unknown = {}) =>
  new NextRequest(`http://127.0.0.1:3000/aleta${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });

async function panggil(method: "GET" | "POST", url: string, body?: unknown) {
  const modul = (await import("@/app/api/aleta-ecourt/tunda-mediasi/route")) as unknown as Record<string, (r: NextRequest) => Promise<Response>>;
  const r = await modul[method](permintaan(url, method, body));
  const isi = (await r.json().catch(() => ({}))) as { data?: Record<string, any>; error?: { message?: string } };
  return { status: r.status, data: isi.data ?? {}, pesan: String(isi.error?.message ?? "") };
}

const KEADAAN_BOT = {
  ok: true,
  boleh: true,
  mediator: "Fahri, S.H.I.",
  majelis: ["Idris, S.H."],
  panitera: ["Andini, S.H."],
  pertemuan: { tanggal: "2026-10-22" },
};

beforeEach(() => {
  keadaan.bot = [];
  keadaan.jawabanGet = { ...KEADAAN_BOT };
  keadaan.jawabanPost = { ok: true, kering: true, baru: { tanggal: "2026-11-05" } };
  keadaan.kehadiran = { adaCatatan: false, baris: [] };
});
afterEach(() => {
  keadaan.aktor = null;
});

describe("C. rute /api/aleta-ecourt/tunda-mediasi", () => {
  it("peran tanpa hak (kasir, jurusita) ditolak 403 pada POST - tidak sampai ke bot", async () => {
    for (const a of [akun("pelaksana", "pos-staf-umum", ["kasir"]), akun("jurusita", "pos-jurusita")]) {
      keadaan.aktor = a as unknown as Record<string, unknown>;
      const r = await panggil("POST", "/api/aleta-ecourt/tunda-mediasi", { mediasiId: "795", tanggal: "2026-10-22", tanggalBaru: "2026-11-05", tempat: "KUA" });
      expect(r.status).toBe(403);
      expect(r.pesan).toMatch(/matriks peran/);
    }
    expect(keadaan.bot).toHaveLength(0);
  });

  it("hakim yang BUKAN majelis/mediator/PP perkara itu ditolak 403 walau golongannya berhak; hakim majelis lolos", async () => {
    keadaan.aktor = akun("hakim", "pos-hakim", [], "Rahman") as unknown as Record<string, unknown>;
    const ditolak = await panggil("POST", "/api/aleta-ecourt/tunda-mediasi", { mediasiId: "795", tanggal: "2026-10-22", tanggalBaru: "2026-11-05", tempat: "KUA", kering: false });
    expect(ditolak.status).toBe(403);
    expect(ditolak.pesan).toMatch(/mediator, majelis, atau panitera pengganti perkara ini/);
    // kepemilikan dibaca dari bot (GET), TIDAK pernah menulis
    expect(keadaan.bot.every((b) => b.pilihan?.method !== "POST")).toBe(true);

    keadaan.bot = [];
    keadaan.aktor = akun("hakim", "pos-hakim", [], "Idris") as unknown as Record<string, unknown>;
    const lolos = await panggil("POST", "/api/aleta-ecourt/tunda-mediasi", { mediasiId: "795", tanggal: "2026-10-22", tanggalBaru: "2026-11-05", tempat: "KUA" });
    expect(lolos.status).toBe(200);
    expect(keadaan.bot.filter((b) => b.pilihan?.method === "POST")).toHaveLength(1);
  });

  it("KERING SEBAGAI BAWAAN: tanpa kering:false yang tegas, bot menerima kering true; Simpan mengirim kering false + tanya jam kerja", async () => {
    keadaan.aktor = akun("admin", "pos-pranata-komputer") as unknown as Record<string, unknown>;
    await panggil("POST", "/api/aleta-ecourt/tunda-mediasi", { mediasiId: "795", tanggal: "2026-10-22", tanggalBaru: "2026-11-05", tempat: "KUA" });
    await panggil("POST", "/api/aleta-ecourt/tunda-mediasi", { mediasiId: "795", tanggal: "2026-10-22", tanggalBaru: "2026-11-05", tempat: "KUA", kering: "false" });
    await panggil("POST", "/api/aleta-ecourt/tunda-mediasi", { mediasiId: "795", tanggal: "2026-10-22", tanggalBaru: "2026-11-05", tempat: "KUA", kering: false, tanyaJamKerja: true, jamKerja: "antrekan" });
    const tulis = keadaan.bot.filter((b) => b.pilihan?.method === "POST").map((b) => b.pilihan!.body!);
    expect(tulis.map((b) => b.kering)).toEqual([true, true, false]);
    expect(tulis[2]).toMatchObject({ mediasiId: "795", tanggal: "2026-10-22", tanggalBaru: "2026-11-05", jamKerja: "antrekan", tanyaJamKerja: true, operator: "usr_uji", operatorAkunSipp: "akun.sipp" });
    // bot membaca nama field `tanggal`/`tanggalBaru` -> cermin segera disegarkan untuk tanggal-tanggal itu
    expect(tulis[0]).toHaveProperty("tanggalBaru");
  });

  it("hari libur nasional dan akhir pekan ditolak 400 di rute, sebelum bot", async () => {
    keadaan.aktor = akun("admin", "pos-pranata-komputer") as unknown as Record<string, unknown>;
    for (const tanggalBaru of ["2026-12-25", "2026-11-08"]) {
      keadaan.bot = [];
      const r = await panggil("POST", "/api/aleta-ecourt/tunda-mediasi", { mediasiId: "795", tanggal: "2026-10-22", tanggalBaru, tempat: "KUA", kering: false });
      expect(r.status, tanggalBaru).toBe(400);
      expect(r.pesan).toMatch(/Tanggal mediasi berikutnya/);
      expect(keadaan.bot.filter((b) => b.pilihan?.method === "POST")).toHaveLength(0);
    }
  });

  it("GET: keadaan + hak Anda + usulan kehadiran dari catatan ALETA; hanya membaca", async () => {
    keadaan.aktor = akun("hakim", "pos-hakim", [], "Idris") as unknown as Record<string, unknown>;
    keadaan.kehadiran = {
      adaCatatan: true,
      baris: ["penggugat", "kuasa_penggugat", "tergugat", "kuasa_tergugat"].map((k) => ({ kedudukan: k, hadir: k === "penggugat", belumDicatat: false })),
    };
    const r = await panggil("GET", "/api/aleta-ecourt/tunda-mediasi?mediasiId=795&tanggal=2026-10-22");
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ boleh: true, bolehAnda: true, usulanKehadiran: "2" });
    expect(keadaan.bot.every((b) => !b.pilihan?.method)).toBe(true);

    keadaan.aktor = akun("hakim", "pos-hakim", [], "Rahman") as unknown as Record<string, unknown>;
    const lain = await panggil("GET", "/api/aleta-ecourt/tunda-mediasi?mediasiId=795&tanggal=2026-10-22");
    expect(lain.data).toMatchObject({ bolehAnda: false });
    expect(lain.data.sebabAnda).toMatch(/hanya untuk mediator, majelis, atau panitera pengganti/);

    const rusak = await panggil("GET", "/api/aleta-ecourt/tunda-mediasi?mediasiId=abc");
    expect(rusak.data).toMatchObject({ ok: false });
  });

  it("penolakan bot ikut ke layar: kalimat di `alasan`, kode di `kode`", async () => {
    keadaan.aktor = akun("admin", "pos-pranata-komputer") as unknown as Record<string, unknown>;
    keadaan.jawabanPost = { ok: false, alasan: "tanggal_berikut_tidak_maju", pesan: "Tanggal mediasi berikutnya harus SESUDAH pertemuan sebelumnya" };
    const r = await panggil("POST", "/api/aleta-ecourt/tunda-mediasi", { mediasiId: "795", tanggal: "2026-10-22", tanggalBaru: "2026-10-23", tempat: "KUA" });
    expect(r.data).toMatchObject({ ok: false, kode: "tanggal_berikut_tidak_maju" });
    expect(r.data.alasan).toMatch(/harus SESUDAH/);
  });
});
