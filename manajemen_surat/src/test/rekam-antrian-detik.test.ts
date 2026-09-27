// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { newDb } from "pg-mem";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { susunRekamAntrian, type BarisRekamAntrian } from "@/lib/rekam-antrian";
import { hitungTigaJarak, type BarisWaktuAntrian, type WaktuAntrian } from "@/lib/tiga-jarak-sidang";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { bacaRekamAntrian, rekamAntrian } from "@/server/modules/aleta-ecourt/rekam-antrian";

/**
 * ============================================================================
 * REKAM ANTRIAN BERDETIK (0051) - MIGRASI, TULISAN, DAN RUTE JADWAL SIDANG
 * ============================================================================
 *
 * Yang dijaga PERILAKUNYA:
 *
 *   - 0051 benar-benar menambah kedelapan kolom, pada tabel 0048 yang sudah
 *     berisi, tanpa kehilangan barisnya; dan hasilnya sama dengan jalur
 *     idempoten schema.ts;
 *   - kolom berdetik TIDAK dihapus oleh pemuatan yang waktunya tidak terbaca;
 *   - rute jadwal sidang tidak lagi menimpa rekaman hari lampau dengan kosong,
 *     dan mengisi kolom berdetik dari hitungan yang sama dengan layar.
 */

const AKAR = process.cwd();
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8");

const KOLOM_0051 = [
  "waktu_ambil_lengkap",
  "jam_jadwal",
  "waktu_panggil_pertama",
  "waktu_panggil_lengkap",
  "jumlah_panggil",
  "menunggu_detik",
  "jarak_sebelum_detik",
  "lama_sidang_detik",
];

type Kolom = { column_name: string; data_type: string; is_nullable: string };

const kueriKolom = `SELECT column_name, data_type, is_nullable FROM information_schema.columns
   WHERE table_name = 'aleta_rekam_antrian' ORDER BY column_name`;

// ---------------------------------------------------------------------------
// Tiruan untuk rute: basis data dalam memori sungguhan, gerbang bot palsu.
// ---------------------------------------------------------------------------
const keadaan = vi.hoisted(() => ({
  db: null as unknown,
  jadwal: null as unknown,
}));

vi.mock("@/server/db/client", async (asli) => ({
  ...(await asli<typeof import("@/server/db/client")>()),
  getDatabase: async () => keadaan.db,
}));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async () => ({ id: "usr_uji", name: "Penguji", roleId: "role_admin" }),
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", async (asli) => ({
  ...(await asli<typeof import("@/server/modules/aleta-bot/whatsapp-gateway-client")>()),
  getGatewayJadwalSidang: async () => ({ ok: true, data: keadaan.jadwal }),
}));

let db: AletaDatabase | null = null;

beforeAll(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: false });
  keadaan.db = db;
});

afterAll(async () => {
  await db?.close();
  db = null;
});

const d = () => db as AletaDatabase;

beforeEach(async () => {
  await d().run("DELETE FROM aleta_rekam_antrian");
});

// ===========================================================================
describe("migrasi 0051", () => {
  it("diklaim sekali pada idx 51, dan berkasnya ada", () => {
    const jurnal = JSON.parse(baca("drizzle/meta/_journal.json")) as { entries: Array<{ idx: number; tag: string }> };
    const punya = jurnal.entries.filter((e) => e.idx === 51);
    expect(punya).toHaveLength(1);
    expect(punya[0].tag).toBe("0051_rekam_antrian_detik");
    expect(jurnal.entries.filter((e) => e.tag.startsWith("0051_"))).toHaveLength(1);
    expect(existsSync(path.join(AKAR, "drizzle", "0051_rekam_antrian_detik.sql"))).toBe(true);
  });

  it("menambah kedelapan kolom pada tabel 0048 yang SUDAH berisi, tanpa kehilangan barisnya", () => {
    const pg = newDb();
    pg.public.none(baca("drizzle/0048_rekam_antrian.sql"));
    pg.public.none(
      `INSERT INTO aleta_rekam_antrian (id, tanggal_sidang, sidang_id, nomor_antrian, jarak_sebelum_menit)
       VALUES ('2026-09-22|s1', '2026-09-22', 's1', 7, 12)`
    );
    pg.public.none(baca("drizzle/0051_rekam_antrian_detik.sql"));
    // Dua kali tidak apa-apa: pemasangan yang mengulang migrasi tidak jatuh.
    pg.public.none(baca("drizzle/0051_rekam_antrian_detik.sql"));

    const kolom = (pg.public.many(kueriKolom) as Kolom[]).map((k) => k.column_name);
    for (const nama of KOLOM_0051) expect(kolom, `kolom ${nama}`).toContain(nama);

    const [lama] = pg.public.many("SELECT * FROM aleta_rekam_antrian") as Array<Record<string, unknown>>;
    expect(lama.nomor_antrian).toBe(7);
    expect(lama.jarak_sebelum_menit).toBe(12);
    // Baris lama mendapat bawaan: kosong, nol hitungan, dan NULL jarak -
    // "belum diketahui", BUKAN "nol detik".
    expect(lama.waktu_ambil_lengkap).toBe("");
    expect(lama.jumlah_panggil).toBe(0);
    expect(lama.menunggu_detik).toBeNull();
    expect(lama.jarak_sebelum_detik).toBeNull();
    expect(lama.lama_sidang_detik).toBeNull();
  });

  it("berkas drizzle dan jalur idempoten schema.ts menghasilkan kolom yang SAMA", async () => {
    const pg = newDb();
    pg.public.none(baca("drizzle/0048_rekam_antrian.sql"));
    pg.public.none(baca("drizzle/0051_rekam_antrian_detik.sql"));
    const dariBerkas = pg.public.many(kueriKolom) as Kolom[];
    const dariSkema = await d().queryAll<Kolom>(kueriKolom);
    expect(dariSkema).toEqual(dariBerkas);
  });

  it("ALTER di schema.ts sendiri menambah kolomnya pada tabel lama", () => {
    // Pemasangan yang melewati berkas drizzle hanya punya jalur ini.
    const skema = baca("src/server/db/schema.ts");
    const alter = [...skema.matchAll(/`(ALTER TABLE aleta_rekam_antrian ADD COLUMN IF NOT EXISTS [^`]+)`/g)].map((m) => m[1]);
    expect(alter).toHaveLength(KOLOM_0051.length);
    const pg = newDb();
    pg.public.none(baca("drizzle/0048_rekam_antrian.sql"));
    for (const pernyataan of alter) pg.public.none(pernyataan);
    const kolom = (pg.public.many(kueriKolom) as Kolom[]).map((k) => k.column_name);
    for (const nama of KOLOM_0051) expect(kolom).toContain(nama);
  });
});

// ===========================================================================
function barisRekam(ubah: Partial<BarisRekamAntrian> = {}): BarisRekamAntrian {
  return {
    id: "2026-09-22|s1",
    tanggalSidang: "2026-09-22",
    sidangId: "s1",
    perkaraId: "101",
    nomorPerkara: "101/Pdt.G/2026/PA.Dgl",
    ruangan: "Ruang Sidang 1",
    nomorAntrian: 3,
    urutanRuang: 2,
    waktuAmbil: "08:10",
    jamPanggil: "09:00",
    online: false,
    keadaan: "dipanggil",
    namaPetugas: "RAHMA",
    jarakSebelumMenit: 12,
    jarakBerikutMenit: 8,
    waktuAmbilLengkap: "2026-09-22 08:10:05",
    jamJadwal: "09:00:00",
    waktuPanggilPertama: "2026-09-22 08:55:00",
    waktuPanggilLengkap: "2026-09-22 09:00:30",
    jumlahPanggil: 2,
    menungguDetik: 3025,
    jarakSebelumDetik: 750,
    lamaSidangDetik: 505,
    adaWaktu: true,
    bersumber: true,
    ...ubah,
  };
}

describe("rekamAntrian - kolom berdetik", () => {
  it("tersimpan dan terbaca kembali utuh", async () => {
    const hasil = await rekamAntrian(d(), [barisRekam()]);
    expect(hasil).toEqual({ ditulis: 1, gagal: "" });
    const [satu] = await bacaRekamAntrian(d(), "2026-09-22", "2026-09-22");
    expect(satu).toMatchObject({
      waktuAmbilLengkap: "2026-09-22 08:10:05",
      jamJadwal: "09:00:00",
      waktuPanggilPertama: "2026-09-22 08:55:00",
      waktuPanggilLengkap: "2026-09-22 09:00:30",
      jumlahPanggil: 2,
      menungguDetik: 3025,
      jarakSebelumDetik: 750,
      lamaSidangDetik: 505,
    });
  });

  it("pemuatan yang waktunya TIDAK terbaca tidak menghapus angka berdetik", async () => {
    await rekamAntrian(d(), [barisRekam()]);
    const [awal] = await bacaRekamAntrian(d(), "2026-09-22", "2026-09-22");
    await rekamAntrian(d(), [
      barisRekam({
        adaWaktu: false,
        namaPetugas: "IWAN",
        waktuAmbilLengkap: "",
        waktuPanggilLengkap: "",
        jumlahPanggil: 0,
        menungguDetik: null,
        jarakSebelumDetik: null,
        lamaSidangDetik: null,
      }),
    ]);
    const [kini] = await bacaRekamAntrian(d(), "2026-09-22", "2026-09-22");
    expect(kini.namaPetugas).toBe("IWAN");
    expect(kini.menungguDetik).toBe(3025);
    expect(kini.jarakSebelumDetik).toBe(750);
    expect(kini.lamaSidangDetik).toBe(505);
    expect(kini.waktuPanggilLengkap).toBe("2026-09-22 09:00:30");
    expect(kini.jumlahPanggil).toBe(2);
    expect(kini.pertamaDirekamAt).toBe(awal.pertamaDirekamAt);
  });

  it("waktu yang terbaca BOLEH mengosongkan: sidang yang kembali berjalan tidak punya lama tetap", async () => {
    await rekamAntrian(d(), [barisRekam()]);
    await rekamAntrian(d(), [barisRekam({ lamaSidangDetik: null, jarakBerikutMenit: null })]);
    const [kini] = await bacaRekamAntrian(d(), "2026-09-22", "2026-09-22");
    expect(kini.lamaSidangDetik).toBeNull();
    expect(kini.jarakBerikutMenit).toBeNull();
  });
});

// ===========================================================================
function waktu(ubah: Partial<BarisWaktuAntrian> & { perkaraId: string; tanggalSidang: string }): BarisWaktuAntrian {
  return {
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
    sumber: "rekaman",
    ...ubah,
  };
}

describe("susunRekamAntrian dengan waktu antrian", () => {
  const LAMPAU = "2026-09-22";
  const sidang = [
    { perkaraId: "101", nomorPerkara: "101/Pdt.G", sidangId: "s101", tanggalSidang: LAMPAU, ruangan: "Ruang Sidang 1" },
    { perkaraId: "102", nomorPerkara: "102/Pdt.G", sidangId: "s102", tanggalSidang: LAMPAU, ruangan: "Ruang Sidang 1" },
    { perkaraId: "103", nomorPerkara: "103/Pdt.G", sidangId: "s103", tanggalSidang: LAMPAU, ruangan: "Ruang Sidang 1" },
  ];
  const barisWaktu = [
    waktu({ perkaraId: "101", tanggalSidang: LAMPAU, nomorAntrian: 4, namaPetugas: "RAHMA", ambilTerawal: `${LAMPAU} 08:10:00`, panggilTerakhir: `${LAMPAU} 09:00:00`, jumlahPanggil: 1 }),
    waktu({ perkaraId: "102", tanggalSidang: LAMPAU, nomorAntrian: 5, ambilTerawal: `${LAMPAU} 08:20:00`, panggilTerakhir: `${LAMPAU} 09:12:59`, jumlahPanggil: 1 }),
  ];
  const tiga = hitungTigaJarak(barisWaktu, { hariIni: "2026-09-27" });
  // Aplikasi antrian sudah tidak menyimpan hari itu: peta langsung kosong.
  const hasil = Object.fromEntries(
    susunRekamAntrian(sidang, {}, { terbaca: true, baris: barisWaktu, tiga }).map((b) => [b.perkaraId, b])
  );

  it("hari lampau: nomor dan waktu diambil dari buku waktu bot", () => {
    expect(hasil["101"]).toMatchObject({
      nomorAntrian: 4,
      namaPetugas: "RAHMA",
      waktuAmbil: "08:10",
      jamPanggil: "09:00",
      keadaan: "dipanggil",
      bersumber: true,
      adaWaktu: true,
      waktuAmbilLengkap: `${LAMPAU} 08:10:00`,
      waktuPanggilLengkap: `${LAMPAU} 09:00:00`,
    });
  });

  it("detik dari hitungan yang SAMA dengan layar; menit lama diturunkan darinya", () => {
    expect(hasil["101"].menungguDetik).toBe(50 * 60);
    expect(hasil["101"].lamaSidangDetik).toBe(12 * 60 + 59);
    // Dibulatkan ke bawah, sama dengan yang tampil: "12 menit".
    expect(hasil["101"].jarakBerikutMenit).toBe(12);
    expect(hasil["102"].jarakSebelumDetik).toBe(12 * 60 + 59);
    expect(hasil["102"].jarakSebelumMenit).toBe(12);
    expect(hasil["101"].urutanRuang).toBe(1);
    expect(hasil["102"].urutanRuang).toBe(2);
  });

  it("yang terakhir pada hari lampau: lama sidang NULL, bukan nol", () => {
    expect(hasil["102"].lamaSidangDetik).toBeNull();
    expect(hasil["102"].jarakBerikutMenit).toBeNull();
  });

  it("perkara tanpa sumber antrian mana pun ditandai tidak bersumber", () => {
    expect(hasil["103"].bersumber).toBe(false);
    expect(hasil["103"].nomorAntrian).toBeNull();
  });
});

// ===========================================================================
function sidangGateway(perkaraId: string, tanggalSidang: string) {
  return {
    sidangId: `s${perkaraId}`,
    perkaraId,
    nomorPerkara: `${perkaraId}/Pdt.G/2026/PA.Dgl`,
    tanggalSidang,
    ruangan: "Ruang Sidang 1",
  };
}

function waktuGateway(ubah: Partial<WaktuAntrian> = {}): WaktuAntrian {
  return {
    terbaca: true,
    alasan: "",
    sekarang: "2026-09-27 10:00:00",
    hariIni: "2026-09-27",
    langsungTerbaca: true,
    rekamanTerbaca: true,
    baris: [],
    ...ubah,
  };
}

async function panggilRute(query: string) {
  const { GET } = await import("@/app/api/aleta-ecourt/sidang/route");
  const jawab = await GET(new NextRequest(`http://localhost/api/aleta-ecourt/sidang?${query}`));
  const isi = (await jawab.json()) as { data?: Record<string, unknown> } & Record<string, unknown>;
  return (isi.data ?? isi) as Record<string, unknown>;
}

describe("rute jadwal sidang - rekaman dan waktuAntrian", () => {
  it("membuka hari LAMPAU tidak menimpa rekaman yang tidak punya sumber", async () => {
    const LAMPAU = "2026-09-22";
    // Rekaman hari itu, ditulis pada harinya. Pemuatan terakhir hari itu
    // terjadi sebelum 101 dipanggil - panggilannya hanya teramati buku waktu
    // bot, sehingga pemuatan sesudahnya MELENGKAPI rekaman 101 (hari lampau
    // hanya bertambah lengkap, lihat gabungRekamLampau).
    await rekamAntrian(d(), [
      barisRekam({
        id: `${LAMPAU}|s101`,
        sidangId: "s101",
        perkaraId: "101",
        tanggalSidang: LAMPAU,
        nomorAntrian: 9,
        keadaan: "menunggu",
        jamPanggil: "",
        waktuPanggilPertama: "",
        waktuPanggilLengkap: "",
        jumlahPanggil: 0,
        menungguDetik: null,
        jarakSebelumDetik: null,
        lamaSidangDetik: null,
        urutanRuang: null,
        jarakSebelumMenit: null,
        jarakBerikutMenit: null,
      }),
      barisRekam({ id: `${LAMPAU}|s102`, sidangId: "s102", perkaraId: "102", tanggalSidang: LAMPAU, nomorAntrian: 5 }),
    ]);

    keadaan.jadwal = {
      ok: true,
      dari: LAMPAU,
      sampai: LAMPAU,
      diperiksaPada: "",
      sidang: [sidangGateway("101", LAMPAU), sidangGateway("102", LAMPAU)],
      // Aplikasi antrian terbaca, tetapi baris hari itu sudah tidak ada.
      antrian: { terbaca: true, alasan: "", tanggal: ["2026-09-27"], peta: {} },
      waktuAntrian: waktuGateway({
        baris: [
          waktu({
            perkaraId: "101",
            tanggalSidang: LAMPAU,
            nomorAntrian: 9,
            ambilTerawal: `${LAMPAU} 08:00:00`,
            panggilTerakhir: `${LAMPAU} 08:45:00`,
            jumlahPanggil: 1,
          }),
        ],
      }),
    };

    const data = await panggilRute(`dari=${LAMPAU}&sampai=${LAMPAU}`);
    expect((data.waktuAntrian as WaktuAntrian).baris).toHaveLength(1);
    expect(data.rekamAntrian).toEqual({ ditulis: 1, gagal: "" });

    const rekaman = Object.fromEntries((await bacaRekamAntrian(d(), LAMPAU, LAMPAU)).map((b) => [b.perkaraId, b]));
    // 102 tidak punya sumber: rekamannya utuh, TIDAK dikosongkan.
    expect(rekaman["102"].nomorAntrian).toBe(5);
    expect(rekaman["102"].menungguDetik).toBe(3025);
    // 101 diperbarui dari buku waktu bot.
    expect(rekaman["101"].nomorAntrian).toBe(9);
    expect(rekaman["101"].menungguDetik).toBe(45 * 60);
    expect(rekaman["101"].waktuPanggilLengkap).toBe(`${LAMPAU} 08:45:00`);
  });

  it("hari INI: yang belum mengambil nomor tetap direkam, yang berjalan disimpan NULL", async () => {
    const HARI = "2026-09-27";
    keadaan.jadwal = {
      ok: true,
      dari: HARI,
      sampai: HARI,
      diperiksaPada: "",
      sidang: [sidangGateway("201", HARI), sidangGateway("202", HARI)],
      antrian: {
        terbaca: true,
        alasan: "",
        tanggal: [HARI],
        peta: {
          201: { nomor: 1, tanggalSidang: HARI, waktuAmbil: "08:10", jamPanggil: "09:30", online: false, keadaan: "dipanggil", namaPetugas: "" },
        },
      },
      waktuAntrian: waktuGateway({
        baris: [
          waktu({ perkaraId: "201", tanggalSidang: HARI, nomorAntrian: 1, ambilTerawal: `${HARI} 08:10:00`, panggilTerakhir: `${HARI} 09:30:00`, jumlahPanggil: 1 }),
        ],
      }),
    };
    const data = await panggilRute(`dari=${HARI}&sampai=${HARI}`);
    expect(data.rekamAntrian).toEqual({ ditulis: 2, gagal: "" });
    const rekaman = Object.fromEntries((await bacaRekamAntrian(d(), HARI, HARI)).map((b) => [b.perkaraId, b]));
    expect(rekaman["201"].menungguDetik).toBe(80 * 60);
    // Terakhir di ruangnya hari ini: masih berjalan -> belum punya angka tetap.
    expect(rekaman["201"].lamaSidangDetik).toBeNull();
    expect(rekaman["202"].nomorAntrian).toBeNull();
  });

  it("bot lama tanpa waktuAntrian: dijawab kosong beserta sebabnya, detik tersimpan tidak dihapus", async () => {
    const HARI = "2026-09-27";
    await rekamAntrian(d(), [
      barisRekam({ id: `${HARI}|s301`, sidangId: "s301", perkaraId: "301", tanggalSidang: HARI, menungguDetik: 1200 }),
    ]);
    keadaan.jadwal = {
      ok: true,
      dari: HARI,
      sampai: HARI,
      diperiksaPada: "",
      sidang: [sidangGateway("301", HARI)],
      antrian: {
        terbaca: true,
        alasan: "",
        tanggal: [HARI],
        peta: { 301: { nomor: 2, tanggalSidang: HARI, waktuAmbil: "08:40", jamPanggil: "", online: false, keadaan: "menunggu", namaPetugas: "" } },
      },
    };
    const data = await panggilRute(`dari=${HARI}&sampai=${HARI}`);
    expect(data.waktuAntrian).toMatchObject({ terbaca: false, alasan: "bot tidak mengirimkan waktu antrian", baris: [] });
    const [rekaman] = await bacaRekamAntrian(d(), HARI, HARI);
    expect(rekaman.nomorAntrian).toBe(2);
    expect(rekaman.menungguDetik).toBe(1200);
  });
});
