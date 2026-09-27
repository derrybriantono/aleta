// @vitest-environment node
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  gabungRekamLampau,
  susunRekamAntrian,
  type BarisRekamAntrian,
} from "@/lib/rekam-antrian";
import { hitungTigaJarak, type BarisWaktuAntrian, type WaktuAntrian } from "@/lib/tiga-jarak-sidang";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { bacaRekamAntrian, rekamAntrian } from "@/server/modules/aleta-ecourt/rekam-antrian";

/**
 * ============================================================================
 * REKAMAN HARI LAMPAU TIDAK BOLEH DIKOSONGKAN - TEMUAN PENELAAH 27 SEP 2026
 * ============================================================================
 *
 * Temuan 2 penelaah gabungan atas 2.39: "waktu antrian terbaca" diputuskan
 * SEKALI per pemuatan, bukan per baris. Akibatnya hari lampau yang barisnya
 * masih ada di aplikasi antrian tetapi TIDAK ada di buku waktu bot - hari
 * sebelum 2.39 terpasang, pencatat dimatikan, panggilan sesudah 18.00 WITA
 * atau akhir pekan - ditulis ulang dengan urutan dan jarak NULL serta
 * kedelapan kolom 0051 kosong. Hari itu sudah tersimpan benar dari data
 * langsung; pemuatan esok harinya yang menimpanya.
 *
 * Yang dijaga di sini:
 *
 *   - waktu antrian dipakai PER BARIS; tanpa baris buku waktu, hitungan lama
 *     (dari aplikasi antrian) yang dipakai - persis 2.38;
 *   - buku waktu yang tidak selaras dengan aplikasi antrian (panggilan yang
 *     tidak pernah teramati pencatat) tidak dipakai untuk jarak antar-perkara;
 *   - rekaman hari lampau hanya BERTAMBAH lengkap: yang sudah terisi tidak
 *     dikosongkan, dan keadaan panggilan tidak mundur.
 */

const LAMPAU = "2026-09-20";
const HARI_INI = "2026-09-27";

// ---------------------------------------------------------------------------
// Skenario penelaah: dua perkara hari lampau, keduanya masih ada di aplikasi
// antrian (09:10 dan 09:40 di Ruang Sidang 1).
// ---------------------------------------------------------------------------
const SIDANG = [
  { perkaraId: "101", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", sidangId: "9001", tanggalSidang: LAMPAU, ruangan: "Ruang Sidang 1" },
  { perkaraId: "102", nomorPerkara: "2/Pdt.G/2026/PA.Dgl", sidangId: "9002", tanggalSidang: LAMPAU, ruangan: "Ruang Sidang 1" },
];
const PETA = {
  "101": { nomor: 1, tanggalSidang: LAMPAU, waktuAmbil: "08:30", jamPanggil: "09:10", online: false, keadaan: "dipanggil", namaPetugas: "A" },
  "102": { nomor: 2, tanggalSidang: LAMPAU, waktuAmbil: "08:40", jamPanggil: "09:40", online: false, keadaan: "dipanggil", namaPetugas: "A" },
};

function waktu(ubah: Partial<BarisWaktuAntrian> & { perkaraId: string }): BarisWaktuAntrian {
  return {
    tanggalSidang: LAMPAU,
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

function waktuUntukRekam(baris: BarisWaktuAntrian[]) {
  return { terbaca: true, baris, tiga: hitungTigaJarak(baris, { hariIni: HARI_INI }), hariIni: HARI_INI };
}

const perPerkara = (baris: BarisRekamAntrian[]) => Object.fromEntries(baris.map((b) => [b.perkaraId, b]));

// ===========================================================================
describe("waktu antrian dipakai PER BARIS", () => {
  it("buku waktu kosong untuk hari itu: hitungan lama dari aplikasi antrian, persis 2.38", () => {
    const lama = perPerkara(susunRekamAntrian(SIDANG, PETA));
    const kini = perPerkara(susunRekamAntrian(SIDANG, PETA, waktuUntukRekam([])));
    for (const id of ["101", "102"]) {
      expect(kini[id].urutanRuang, `urutan ${id}`).toBe(lama[id].urutanRuang);
      expect(kini[id].jarakSebelumMenit, `jarak sebelum ${id}`).toBe(lama[id].jarakSebelumMenit);
      expect(kini[id].jarakBerikutMenit, `jarak berikut ${id}`).toBe(lama[id].jarakBerikutMenit);
      // Tidak ada baris buku waktu -> kolom 0051 TIDAK disentuh.
      expect(kini[id].adaWaktu, `adaWaktu ${id}`).toBe(false);
      expect(kini[id].bersumber).toBe(true);
    }
    expect(kini["101"].urutanRuang).toBe(1);
    expect(kini["101"].jarakBerikutMenit).toBe(30);
    expect(kini["102"].jarakSebelumMenit).toBe(30);
  });

  it("buku waktu TIDAK SELARAS (panggilan 102 tidak pernah teramati pencatat): jarak dari aplikasi antrian", () => {
    // Pencatat berhenti pukul 18.00 - atau mati - sebelum 102 dipanggil.
    // Buku waktu mengenal 101 saja; aplikasi antrian tahu keduanya.
    const buku = [
      waktu({ perkaraId: "101", nomorAntrian: 1, ambilTerawal: `${LAMPAU} 08:30:00`, panggilTerakhir: `${LAMPAU} 09:10:00`, panggilPertama: `${LAMPAU} 09:10:00`, jumlahPanggil: 1 }),
      waktu({ perkaraId: "102", nomorAntrian: 2, ambilTerawal: `${LAMPAU} 08:40:00` }),
    ];
    const kini = perPerkara(susunRekamAntrian(SIDANG, PETA, waktuUntukRekam(buku)));
    // Dengan buku saja, 101 adalah yang terakhir di ruangnya dan lama
    // sidangnya "tidak diketahui". Aplikasi antrian tahu 102 dipanggil 09:40.
    expect(kini["101"].jarakBerikutMenit).toBe(30);
    expect(kini["102"].jarakSebelumMenit).toBe(30);
    expect(kini["102"].urutanRuang).toBe(2);
    // Jarak berdetik antar-perkara tidak dikarang dari buku yang bolong.
    expect(kini["101"].lamaSidangDetik).toBeNull();
    // Yang milik baris itu sendiri dan SELARAS tetap diisi.
    expect(kini["101"].waktuPanggilLengkap).toBe(`${LAMPAU} 09:10:00`);
    expect(kini["101"].menungguDetik).toBe(40 * 60);
    // Panggilan 102 menurut buku tidak ada - bukan kosong yang ditulis sebagai fakta.
    expect(kini["102"].waktuPanggilLengkap).toBe("");
  });

  it("panggilan ulang yang tidak teramati: waktu panggil buku yang basi tidak dipakai", () => {
    const peta = { ...PETA, "101": { ...PETA["101"], jamPanggil: "18:30" } };
    const buku = [
      waktu({ perkaraId: "101", ambilTerawal: `${LAMPAU} 08:30:00`, panggilTerakhir: `${LAMPAU} 09:10:00`, jumlahPanggil: 1 }),
      waktu({ perkaraId: "102", ambilTerawal: `${LAMPAU} 08:40:00`, panggilTerakhir: `${LAMPAU} 09:40:00`, jumlahPanggil: 1 }),
    ];
    const kini = perPerkara(susunRekamAntrian(SIDANG, peta, waktuUntukRekam(buku)));
    expect(kini["101"].waktuPanggilLengkap).toBe("");
    expect(kini["101"].menungguDetik).toBeNull();
    // Urutan menurut aplikasi antrian: 102 (09:40) lalu 101 (18:30).
    expect(kini["102"].urutanRuang).toBe(1);
    expect(kini["101"].urutanRuang).toBe(2);
  });

  it("buku waktu SELARAS: tiga jarak yang dipakai, sama dengan layar", () => {
    const buku = [
      waktu({ perkaraId: "101", ambilTerawal: `${LAMPAU} 08:30:00`, panggilTerakhir: `${LAMPAU} 09:10:20`, jumlahPanggil: 1 }),
      waktu({ perkaraId: "102", ambilTerawal: `${LAMPAU} 08:40:00`, panggilTerakhir: `${LAMPAU} 09:40:05`, jumlahPanggil: 1 }),
    ];
    const kini = perPerkara(susunRekamAntrian(SIDANG, PETA, waktuUntukRekam(buku)));
    expect(kini["101"].lamaSidangDetik).toBe(29 * 60 + 45);
    expect(kini["101"].jarakBerikutMenit).toBe(29);
    expect(kini["102"].jarakSebelumDetik).toBe(29 * 60 + 45);
    expect(kini["101"].adaWaktu).toBe(true);
  });

  it("baris hari lampau ditandai lampau; hari ini tidak", () => {
    const hariIni = [{ ...SIDANG[0], sidangId: "9101", tanggalSidang: HARI_INI }];
    const hasil = susunRekamAntrian([...SIDANG, ...hariIni], PETA, waktuUntukRekam([]));
    expect(hasil.filter((b) => b.tanggalSidang === LAMPAU).every((b) => b.lampau === true)).toBe(true);
    expect(hasil.find((b) => b.tanggalSidang === HARI_INI)?.lampau).toBe(false);
  });
});

// ===========================================================================
function rekam(ubah: Partial<BarisRekamAntrian> = {}): BarisRekamAntrian {
  return {
    id: `${LAMPAU}|9001`,
    tanggalSidang: LAMPAU,
    sidangId: "9001",
    perkaraId: "101",
    nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
    ruangan: "Ruang Sidang 1",
    nomorAntrian: 1,
    urutanRuang: 1,
    waktuAmbil: "08:30",
    jamPanggil: "09:10",
    online: false,
    keadaan: "dipanggil",
    namaPetugas: "A",
    jarakSebelumMenit: null,
    jarakBerikutMenit: 30,
    waktuAmbilLengkap: `${LAMPAU} 08:30:00`,
    jamJadwal: "09:00:00",
    waktuPanggilPertama: `${LAMPAU} 09:10:00`,
    waktuPanggilLengkap: `${LAMPAU} 09:10:00`,
    jumlahPanggil: 1,
    menungguDetik: 2400,
    jarakSebelumDetik: null,
    lamaSidangDetik: 1800,
    adaWaktu: true,
    bersumber: true,
    lampau: true,
    ...ubah,
  };
}

describe("gabungRekamLampau - hari lampau hanya bertambah lengkap", () => {
  it("yang baru kosong tidak mengosongkan yang tersimpan", () => {
    const tersimpan = rekam();
    const baru = rekam({
      adaWaktu: false,
      urutanRuang: null,
      jarakBerikutMenit: null,
      waktuAmbilLengkap: "",
      jamJadwal: "",
      waktuPanggilPertama: "",
      waktuPanggilLengkap: "",
      jumlahPanggil: 0,
      menungguDetik: null,
      lamaSidangDetik: null,
      namaPetugas: "",
    });
    const hasil = gabungRekamLampau(tersimpan, baru);
    expect(hasil).toMatchObject({
      urutanRuang: 1,
      jarakBerikutMenit: 30,
      waktuAmbilLengkap: `${LAMPAU} 08:30:00`,
      jamJadwal: "09:00:00",
      waktuPanggilLengkap: `${LAMPAU} 09:10:00`,
      jumlahPanggil: 1,
      menungguDetik: 2400,
      lamaSidangDetik: 1800,
      namaPetugas: "A",
    });
  });

  it("keadaan panggilan tidak mundur: buku basi 'menunggu' tidak menimpa 'dipanggil'", () => {
    const baru = rekam({
      keadaan: "menunggu",
      jamPanggil: "09:00",
      waktuPanggilLengkap: "",
      urutanRuang: null,
      jarakBerikutMenit: null,
      menungguDetik: null,
      lamaSidangDetik: null,
    });
    const hasil = gabungRekamLampau(rekam(), baru);
    expect(hasil.keadaan).toBe("dipanggil");
    expect(hasil.jamPanggil).toBe("09:10");
    expect(hasil.lamaSidangDetik).toBe(1800);
  });

  it("yang baru LEBIH lengkap diterima: panggilan sesudah pemuatan terakhir hari itu", () => {
    // Tersimpan pukul 16.00 saat 101 masih menunggu; buku waktu melihat
    // panggilannya pukul 16.40.
    const tersimpan = rekam({
      keadaan: "menunggu",
      jamPanggil: "09:00",
      waktuPanggilLengkap: "",
      waktuPanggilPertama: "",
      urutanRuang: null,
      jarakBerikutMenit: null,
      menungguDetik: null,
      lamaSidangDetik: null,
      jumlahPanggil: 0,
    });
    const baru = rekam({ jamPanggil: "16:40", waktuPanggilLengkap: `${LAMPAU} 16:40:12`, waktuPanggilPertama: `${LAMPAU} 16:40:12`, menungguDetik: 29172, lamaSidangDetik: null, jarakBerikutMenit: null, urutanRuang: 3 });
    const hasil = gabungRekamLampau(tersimpan, baru);
    expect(hasil).toMatchObject({ keadaan: "dipanggil", jamPanggil: "16:40", waktuPanggilLengkap: `${LAMPAU} 16:40:12`, urutanRuang: 3, menungguDetik: 29172, jumlahPanggil: 1 });
  });

  it("panggilan yang lebih akhir menang - panggilan ulang tidak tertimpa buku yang basi", () => {
    const tersimpan = rekam({ jamPanggil: "18:30", waktuPanggilLengkap: `${LAMPAU} 18:30:05`, lamaSidangDetik: null, jarakBerikutMenit: null, urutanRuang: 2, jumlahPanggil: 2 });
    const baru = rekam({ jamPanggil: "09:10", waktuPanggilLengkap: `${LAMPAU} 09:10:00`, lamaSidangDetik: 1800, jarakBerikutMenit: 30, urutanRuang: 1, jumlahPanggil: 1 });
    const hasil = gabungRekamLampau(tersimpan, baru);
    expect(hasil).toMatchObject({ jamPanggil: "18:30", waktuPanggilLengkap: `${LAMPAU} 18:30:05`, urutanRuang: 2, jumlahPanggil: 2 });
    // Jarak milik panggilan 09:10 TIDAK dicampur ke panggilan 18:30.
    expect(hasil.lamaSidangDetik).toBeNull();
    expect(hasil.jarakBerikutMenit).toBeNull();
    // Panggilan pertama yang TERAWAL tetap.
    expect(hasil.waktuPanggilPertama).toBe(`${LAMPAU} 09:10:00`);
  });

  it("panggilan yang sama: detik mengisi yang hanya punya menit", () => {
    const tersimpan = rekam({ waktuPanggilLengkap: "", menungguDetik: null, lamaSidangDetik: null });
    const baru = rekam({ jarakBerikutMenit: null, urutanRuang: null });
    const hasil = gabungRekamLampau(tersimpan, baru);
    expect(hasil).toMatchObject({ waktuPanggilLengkap: `${LAMPAU} 09:10:00`, menungguDetik: 2400, lamaSidangDetik: 1800, jarakBerikutMenit: 30, urutanRuang: 1 });
  });

  it("tanpa rekaman tersimpan: baris baru apa adanya", () => {
    const baru = rekam({ adaWaktu: false });
    expect(gabungRekamLampau(undefined, baru)).toEqual(baru);
  });
});

// ===========================================================================
// Basis data dan rute
// ===========================================================================
const keadaan = vi.hoisted(() => ({
  db: null as unknown,
  jadwal: null as unknown,
  paramJadwal: [] as unknown[],
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
  getGatewayJadwalSidang: async (param: unknown) => {
    keadaan.paramJadwal.push(param);
    return { ok: true, data: keadaan.jadwal };
  },
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

beforeEach(async () => {
  await (db as AletaDatabase).run("DELETE FROM aleta_rekam_antrian");
  keadaan.paramJadwal = [];
});

const d = () => db as AletaDatabase;

describe("rekamAntrian - baris hari lampau", () => {
  it("tulisan hari lampau yang kurang lengkap tidak mengosongkan rekaman yang tersimpan", async () => {
    await rekamAntrian(d(), [rekam({ lampau: false })]);
    await rekamAntrian(d(), [
      rekam({
        adaWaktu: true,
        waktuAmbilLengkap: "",
        jamJadwal: "",
        waktuPanggilLengkap: "",
        waktuPanggilPertama: "",
        jumlahPanggil: 0,
        menungguDetik: null,
        lamaSidangDetik: null,
        urutanRuang: null,
        jarakBerikutMenit: null,
      }),
    ]);
    const [kini] = await bacaRekamAntrian(d(), LAMPAU, LAMPAU);
    expect(kini).toMatchObject({
      urutanRuang: 1,
      jarakBerikutMenit: 30,
      waktuAmbilLengkap: `${LAMPAU} 08:30:00`,
      waktuPanggilLengkap: `${LAMPAU} 09:10:00`,
      jumlahPanggil: 1,
      menungguDetik: 2400,
      lamaSidangDetik: 1800,
    });
  });
});

function sidangGateway(perkaraId: string, sidangId: string, tanggalSidang: string) {
  return { sidangId, perkaraId, nomorPerkara: `${perkaraId}/Pdt.G/2026/PA.Dgl`, tanggalSidang, ruangan: "Ruang Sidang 1" };
}

function waktuGateway(ubah: Partial<WaktuAntrian> = {}): WaktuAntrian {
  return {
    terbaca: true,
    alasan: "",
    sekarang: `${HARI_INI} 10:00:00`,
    hariIni: HARI_INI,
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

describe("rute jadwal sidang - skenario penelaah dari ujung ke ujung", () => {
  it("hari lampau yang buku waktunya kosong: rekaman hari itu TIDAK dikosongkan", async () => {
    // Hari itu direkam benar dari data langsung (2.38, atau pemuatan pada harinya).
    await rekamAntrian(d(), [
      rekam({ lampau: false }),
      rekam({
        lampau: false,
        id: `${LAMPAU}|9002`,
        sidangId: "9002",
        perkaraId: "102",
        nomorAntrian: 2,
        urutanRuang: 2,
        jamPanggil: "09:40",
        waktuAmbil: "08:40",
        jarakSebelumMenit: 30,
        jarakBerikutMenit: null,
        waktuAmbilLengkap: `${LAMPAU} 08:40:00`,
        waktuPanggilPertama: `${LAMPAU} 09:40:00`,
        waktuPanggilLengkap: `${LAMPAU} 09:40:00`,
        menungguDetik: 3600,
        jarakSebelumDetik: 1800,
        lamaSidangDetik: null,
      }),
    ]);

    keadaan.jadwal = {
      ok: true,
      dari: LAMPAU,
      sampai: LAMPAU,
      diperiksaPada: "",
      sidang: [sidangGateway("101", "9001", LAMPAU), sidangGateway("102", "9002", LAMPAU)],
      antrian: { terbaca: true, alasan: "", tanggal: [LAMPAU], peta: PETA },
      // Buku waktu terbaca, tetapi tidak punya baris hari itu.
      waktuAntrian: waktuGateway(),
    };

    const data = await panggilRute(`dari=${LAMPAU}&sampai=${LAMPAU}`);
    expect(data.rekamAntrian).toEqual({ ditulis: 2, gagal: "" });

    const kini = Object.fromEntries((await bacaRekamAntrian(d(), LAMPAU, LAMPAU)).map((b) => [b.perkaraId, b]));
    expect(kini["101"]).toMatchObject({ urutanRuang: 1, jarakBerikutMenit: 30, menungguDetik: 2400, lamaSidangDetik: 1800, waktuPanggilLengkap: `${LAMPAU} 09:10:00` });
    expect(kini["102"]).toMatchObject({ urutanRuang: 2, jarakSebelumMenit: 30, menungguDetik: 3600, jarakSebelumDetik: 1800, waktuPanggilLengkap: `${LAMPAU} 09:40:00` });
  });

  it("hari lampau dengan buku waktu BASI (panggilan 18.30 tidak teramati): rekaman berdetik hari itu tidak dikosongkan", async () => {
    // Pada harinya, pukul 18.35, layar memuat data langsung yang lengkap:
    // 101 dipanggil 18:30:05. Pencatat sudah berhenti pukul 18.00, jadi buku
    // waktunya hanya tahu 101 mengambil nomor.
    await rekamAntrian(d(), [
      rekam({
        lampau: false,
        jamPanggil: "18:30",
        waktuPanggilPertama: `${LAMPAU} 18:30:05`,
        waktuPanggilLengkap: `${LAMPAU} 18:30:05`,
        menungguDetik: 36005,
        lamaSidangDetik: null,
        jarakBerikutMenit: null,
      }),
    ]);

    keadaan.jadwal = {
      ok: true,
      dari: LAMPAU,
      sampai: LAMPAU,
      diperiksaPada: "",
      sidang: [sidangGateway("101", "9001", LAMPAU)],
      antrian: {
        terbaca: true,
        alasan: "",
        tanggal: [LAMPAU],
        peta: { "101": { ...PETA["101"], jamPanggil: "18:30" } },
      },
      waktuAntrian: waktuGateway({
        baris: [waktu({ perkaraId: "101", nomorAntrian: 1, ambilTerawal: `${LAMPAU} 08:30:00` })],
      }),
    };

    const data = await panggilRute(`dari=${LAMPAU}&sampai=${LAMPAU}`);
    expect(data.rekamAntrian).toEqual({ ditulis: 1, gagal: "" });
    const [kini] = await bacaRekamAntrian(d(), LAMPAU, LAMPAU);
    expect(kini).toMatchObject({
      keadaan: "dipanggil",
      jamPanggil: "18:30",
      waktuPanggilLengkap: `${LAMPAU} 18:30:05`,
      waktuPanggilPertama: `${LAMPAU} 18:30:05`,
      menungguDetik: 36005,
      jumlahPanggil: 1,
    });
  });

  it("rute jadwal sidang MEMINTA waktu antrian dari bot - pemanggil lain tidak", async () => {
    keadaan.jadwal = {
      ok: true,
      dari: HARI_INI,
      sampai: HARI_INI,
      diperiksaPada: "",
      sidang: [],
      antrian: { terbaca: true, alasan: "", tanggal: [], peta: {} },
    };
    await panggilRute(`dari=${HARI_INI}&sampai=${HARI_INI}`);
    expect(keadaan.paramJadwal).toHaveLength(1);
    expect(keadaan.paramJadwal[0]).toMatchObject({ waktu: true });
  });
});
