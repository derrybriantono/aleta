// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * "MEMBACA DAFTAR PERKARA SIPP TERLALU LAMBAT" - 2 NOV 2026 (butir 13)
 * ============================================================================
 *
 * Daftar perkara Blangko Derry (api/aleta-ecourt/perkara-saya) membaca jadwal bot per MINGGU ("Semua perkara saya" = 20 potongan).
 * Tiap potongan dahulu = jawaban jadwal LENGKAP (puluhan kueri SIPP: umur perkara, panggilan/relaas, mediasi, saksi, varian putusan
 * dari petitum, kumulasi, sita, ...) yang hampir seluruhnya dibuang portal; potongan dibaca per GELOMBANG empat.
 *
 *   A. bot: jawaban RINGKAS - ruas yang dipakai daftar SETARA dengan jawaban lengkap untuk data yang sama (termasuk tanda gagal
 *      baca), dengan kueri SIPP jauh lebih sedikit; peta antrian tidak dibaca.
 *   B. portal: kunci singgahan ringkas terpisah; ringkas boleh meminjam jawaban lengkap, tidak sebaliknya.
 *   C. portal: potongan dibaca dengan paling banyak 4 serentak tanpa menunggu gelombang; gagal satu = 502 (tidak berubah).
 *
 * Data rekaan seluruhnya (nama dan nomor perkara karangan).
 */

const AKAR = path.resolve(process.cwd(), "..");
const muatBot = createRequire(path.join(AKAR, "aleta_bot/package.json"));

type Kueri = (sql: string, params: unknown, cb: (e: unknown, r?: unknown) => void) => void;

// ----------------------------------------------------------------------------
// Data rekaan SIPP
// ----------------------------------------------------------------------------
const JADWAL = [
  { sidangId: 501, perkaraId: 9001, nomorPerkara: "101/Pdt.G/2099/PA.Uji", jenisPerkara: "Cerai Gugat", alurPerkaraId: 15, jenisPerkaraId: 347, tanggalSidang: "2099-01-05", jamSidang: "09:00:00", agenda: "Pembuktian", ruangan: "Ruang 1", ditunda: "Y", ikrarTalak: "T", sidangKeliling: "T", urutan: 3, dihadiriOleh: 1, edocBas: "bas.pdf", alasanDitunda: "Pembuktian saksi" },
  { sidangId: 502, perkaraId: 9002, nomorPerkara: "102/Pdt.G/2099/PA.Uji", jenisPerkara: "Cerai Talak", alurPerkaraId: 15, jenisPerkaraId: 346, tanggalSidang: "2099-01-05", jamSidang: "10:00:00", agenda: "Ikrar talak", ruangan: "Ruang 2", ditunda: "T", ikrarTalak: "Y", sidangKeliling: "Y", urutan: 5, dihadiriOleh: null, edocBas: null, alasanDitunda: "0" },
  { sidangId: 503, perkaraId: 9001, nomorPerkara: "101/Pdt.G/2099/PA.Uji", jenisPerkara: "Cerai Gugat", alurPerkaraId: 15, jenisPerkaraId: 347, tanggalSidang: "2099-01-07", jamSidang: "09:30:00", agenda: "Putusan", ruangan: "Ruang 1", ditunda: "T", ikrarTalak: "T", sidangKeliling: "T", urutan: 4, dihadiriOleh: 2, edocBas: "", alasanDitunda: "" },
];

function jawabRekaan(sql: string, gagal: { putusan?: boolean }): unknown[] | Error {
  if (/FROM perkara_jadwal_sidang j\s+JOIN perkara p ON p\.perkara_id = j\.perkara_id/.test(sql) && /LIMIT \?/.test(sql)) return JADWAL;
  if (/FROM perkara_hakim_pn hk/.test(sql) && /hk\.perkara_id IN/.test(sql))
    return [
      { perkaraId: 9001, kode: "M1", nama: "Drs. Hakim Rekaan Satu", urutan: 1, aktif: "Y" },
      { perkaraId: 9002, kode: "M2", nama: "Hakim Rekaan Dua, S.H.I.", urutan: 1, aktif: "Y" },
    ];
  if (/FROM perkara_panitera_pn pn/.test(sql) && /pn\.perkara_id IN/.test(sql)) return [{ perkaraId: 9001, nama: "Panitera Rekaan", urutan: 1, aktif: "Y" }];
  if (/FROM perkara_jurusita js/.test(sql) && /js\.perkara_id IN/.test(sql)) return [{ perkaraId: 9002, nama: "Jurusita Rekaan", urutan: 1, aktif: "Y" }];
  if (/FROM perkara_putusan pu/.test(sql) && /GROUP BY pu\.perkara_id/.test(sql) && /statusPutusan/.test(sql)) {
    if (gagal.putusan) return new Error("ER_UJI: putusan tidak terbaca");
    return [{ perkaraId: 9002, tanggalPutusan: "2098-12-01", tanggalMinutasi: "2098-12-03", tanggalBht: null, verstek: "Y", amarVerstek: 1, adaBerkasPutusan: 1, statusPutusan: "Dikabulkan" }];
  }
  if (/FROM perkara_efiling_id k/.test(sql)) return [{ perkaraId: 9001 }];
  if (/vp\.pihak_ke AS pihakKe/.test(sql))
    return [
      { perkaraId: 9001, nama: "Penggugat Rekaan binti Fulan", pihakKe: 1 },
      { perkaraId: 9001, nama: "Tergugat Rekaan bin Fulan", pihakKe: 2 },
      { perkaraId: 9002, nama: "Pemohon Rekaan bin Fulan", pihakKe: 1 },
    ];
  return [];
}

let db: { query: Kueri; end?: (cb?: () => void) => void };
let botDb: { query: (...a: unknown[]) => Promise<unknown> };
let layanan: {
  daftarSidang: (p: Record<string, unknown>) => Promise<{ sidang: Array<Record<string, unknown>>; ringkas?: boolean }>;
  BIDANG_RINGKAS: string;
  RUAS_RINGKAS: readonly string[];
};
let kueriAsli: Kueri;
let botQueryAsli: (...a: unknown[]) => Promise<unknown>;
type Skema = Record<string, unknown> & {
  CALON: Record<string, { tabel: string; calon: string[] }>;
  tabelAda: unknown;
  kolomAda: unknown;
  pilihKolom: unknown;
  kolomTabel: unknown;
  kolomTerpilih: unknown;
};
let skema: Skema;
let skemaAsli: Record<string, unknown>;

beforeAll(() => {
  process.env.ALETA_BOT_DB_SIPP_HOST = process.env.ALETA_BOT_DB_SIPP_HOST || "127.0.0.1";
  db = muatBot(path.join(AKAR, "aleta_bot/db_config.js"));
  botDb = muatBot(path.join(AKAR, "aleta_bot/services/botDbService.js"));
  layanan = muatBot(path.join(AKAR, "aleta_bot/services/sippJadwalSidangService.js"));
  kueriAsli = db.query;
  botQueryAsli = botDb.query;
  // Skema SIPP tiruan: SELURUH tabel/kolom calon dianggap ada (seperti SIPP satker) - supaya jalur lengkap menjalankan semua
  // kueri pelengkapnya seperti di server, bukan melompatinya karena "kolom tidak ada".
  skema = muatBot(path.join(AKAR, "aleta_bot/services/sippSkemaService.js"));
  skemaAsli = { ...skema };
  skema.tabelAda = async () => true;
  skema.kolomAda = async () => true;
  skema.pilihKolom = async (_t: string, calon: string[] = []) => calon[0] || "";
  skema.kolomTabel = async () => [];
  skema.kolomTerpilih = async () => Object.fromEntries(Object.entries(skema.CALON).map(([n, a]) => [n, a.calon[0] || ""]));
}, 20000);

afterAll(async () => {
  Object.assign(skema, skemaAsli);
  db.query = kueriAsli;
  botDb.query = botQueryAsli;
  await new Promise<void>((r) => {
    try {
      if (typeof db.end === "function") db.end(() => r());
      else r();
    } catch {
      r();
    }
  });
});

/** daftarSidang dengan SIPP & basis data bot tiruan; mengembalikan jawaban dan seluruh SQL yang terkirim ke SIPP. */
async function jalankanDaftar(bidang: string, gagal: { putusan?: boolean } = {}) {
  const sipp: string[] = [];
  let kueriBot = 0;
  db.query = ((sql: string, params: unknown, cb: (e: unknown, r?: unknown) => void) => {
    const teks = String(sql);
    sipp.push(teks);
    const j = jawabRekaan(teks, gagal);
    setTimeout(() => (j instanceof Error ? cb(j) : cb(null, j)), 0);
  }) as Kueri;
  botDb.query = (async () => {
    kueriBot += 1;
    return [];
  }) as typeof botDb.query;
  try {
    const hasil = await layanan.daftarSidang({ dari: "2099-01-05", sampai: "2099-01-11", cari: "", batas: 500, ...(bidang ? { bidang } : {}) });
    return { hasil, sipp, kueriBot };
  } finally {
    db.query = kueriAsli;
    botDb.query = botQueryAsli;
  }
}

describe("A. bot - jadwal ringkas untuk daftar perkara", () => {
  it("ruas ringkas SETARA dengan jawaban lengkap untuk data yang sama; jumlah kueri SIPP turun jauh", async () => {
    const lengkap = await jalankanDaftar("");
    const ringkas = await jalankanDaftar(layanan.BIDANG_RINGKAS);
    expect(ringkas.hasil.ringkas).toBe(true);
    expect(lengkap.hasil.ringkas).toBeUndefined();
    expect(ringkas.hasil.sidang.length).toBe(3);
    expect(lengkap.hasil.sidang.length).toBe(3);
    ringkas.hasil.sidang.forEach((baris, i) => {
      // Hanya ruas ringkas yang dikirim, dan nilainya sama persis dengan ruas yang sama pada jawaban lengkap.
      expect(Object.keys(baris).sort()).toEqual([...layanan.RUAS_RINGKAS].sort());
      for (const ruas of layanan.RUAS_RINGKAS) expect(baris[ruas], `${i}:${ruas}`).toEqual(lengkap.hasil.sidang[i][ruas]);
    });
    // Data rekaan benar-benar terbaca (bukan setara karena sama-sama kosong).
    expect(ringkas.hasil.sidang[0]).toMatchObject({
      majelisNama: "Drs. Hakim Rekaan Satu",
      paniteraNama: "Panitera Rekaan",
      lewatEcourt: true,
      ditunda: true,
      adaBas: true,
      pihak: { penggugat: ["Penggugat Rekaan binti Fulan"], tergugat: ["Tergugat Rekaan bin Fulan"] },
    });
    expect(ringkas.hasil.sidang[1]).toMatchObject({ sudahPutus: true, tanggalPutusan: "2098-12-01", tanggalMinutasi: "2098-12-03", adaBerkasPutusan: true, verstekPutusan: true, jurusitaNama: "Jurusita Rekaan", sidangIkrarTalak: true, putusanTerbaca: true });

    // Kueri: ringkas hanya jadwal + pihak + petugas + putusan + e-Court + penanda ghaib/prodeo; tanpa kueri basis data bot.
    console.info(`[ukur] kueri SIPP per potongan: lengkap ${lengkap.sipp.length}, ringkas ${ringkas.sipp.length}; kueri basis data bot: lengkap ${lengkap.kueriBot}, ringkas ${ringkas.kueriBot}`);
    expect(ringkas.sipp.length).toBeLessThan(lengkap.sipp.length / 2);
    expect(ringkas.kueriBot).toBe(0);
    const gabung = ringkas.sipp.join("\n");
    for (const tabelPelengkap of ["perkara_mediasi", "perkara_pengacara", "perkara_ikrar_talak", "perkara_court_calendar", "perkara_kumulasi"]) {
      expect(gabung, tabelPelengkap).not.toContain(tabelPelengkap);
    }
    // Kueri utama yang sama persis (syarat, urutan, batas) dipakai kedua jawaban.
    expect(ringkas.sipp[0]).toBe(lengkap.sipp[0]);
  }, 60000);

  it("peta putusan gagal dibaca: ringkas menandainya sama seperti lengkap (putusanTerbaca false, bukan 'belum putus')", async () => {
    const lengkap = await jalankanDaftar("", { putusan: true });
    const ringkas = await jalankanDaftar(layanan.BIDANG_RINGKAS, { putusan: true });
    for (let i = 0; i < 3; i += 1) {
      expect(ringkas.hasil.sidang[i].putusanTerbaca).toBe(false);
      for (const ruas of layanan.RUAS_RINGKAS) expect(ringkas.hasil.sidang[i][ruas], ruas).toEqual(lengkap.hasil.sidang[i][ruas]);
    }
  }, 60000);

  it("rute bot: ?bidang=ringkas tidak membaca peta antrian; tanpa bidang jawaban lengkap + antrian seperti semula", async () => {
    const antrian = muatBot(path.join(AKAR, "aleta_bot/services/antrianSidangService.js")) as { petaAntrian: () => Promise<unknown> };
    const petaAsli = antrian.petaAntrian;
    let petaDibaca = 0;
    antrian.petaAntrian = async () => {
      petaDibaca += 1;
      return { terbaca: true, alasan: "", peta: {}, tanggal: [] };
    };
    const router = muatBot(path.join(AKAR, "aleta_bot/routes/internalGatewayRoutes.js")) as { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (q: unknown, s: unknown) => unknown }> } }> };
    const lapis = router.stack.find((l) => l.route?.path === "/sipp/jadwal-sidang" && l.route.methods.get)!;
    const penangan = lapis.route!.stack[lapis.route!.stack.length - 1].handle;
    const panggil = async (query: Record<string, string>) => {
      let isi: Record<string, unknown> | null = null;
      db.query = ((sql: string, _p: unknown, cb: (e: unknown, r?: unknown) => void) => {
        const j = jawabRekaan(String(sql), {});
        setTimeout(() => (j instanceof Error ? cb(j) : cb(null, j)), 0);
      }) as Kueri;
      botDb.query = (async () => []) as typeof botDb.query;
      try {
        await penangan({ query }, { json: (x: Record<string, unknown>) => (isi = x), status: () => ({ json: (x: Record<string, unknown>) => (isi = x) }) });
      } finally {
        db.query = kueriAsli;
        botDb.query = botQueryAsli;
      }
      return isi as unknown as Record<string, unknown>;
    };
    try {
      const r = await panggil({ dari: "2099-01-05", sampai: "2099-01-11", batas: "500", bidang: "ringkas" });
      expect(r.ok).toBe(true);
      expect(r.ringkas).toBe(true);
      expect(r).not.toHaveProperty("antrian");
      expect(petaDibaca).toBe(0);
      const l = await panggil({ dari: "2099-01-05", sampai: "2099-01-11", batas: "500" });
      expect(l.ok).toBe(true);
      expect(l).toHaveProperty("antrian");
      expect(l.ringkas).toBeUndefined();
      expect(petaDibaca).toBe(1);
    } finally {
      antrian.petaAntrian = petaAsli;
    }
  }, 60000);
});

// ============================================================================
// B. Singgahan jadwal portal
// ============================================================================
describe("B. singgahan jadwal - kunci ringkas", () => {
  it("kunci ringkas berbeda; kunci lama tidak berubah; ringkas meminjam lengkap, lengkap tidak meminjam ringkas", async () => {
    const { kunciSinggahJadwal, kunciPinjaman } = await import("@/server/modules/aleta-bot/jadwal-sidang-singgah");
    const dasar = { dari: "2099-01-05", sampai: "2099-01-11", cari: "", batas: 500 };
    expect(kunciSinggahJadwal(dasar)).toBe(JSON.stringify(["2099-01-05", "2099-01-11", "", 500, false]));
    const kunciRingkas = kunciSinggahJadwal({ ...dasar, bidang: "ringkas" });
    expect(kunciRingkas).not.toBe(kunciSinggahJadwal(dasar));
    const pinjamRingkas = kunciPinjaman({ ...dasar, bidang: "ringkas" }).map((k) => k.kunci);
    expect(pinjamRingkas).toContain(kunciSinggahJadwal(dasar));
    expect(pinjamRingkas).toContain(kunciSinggahJadwal({ ...dasar, waktu: true }));
    const pinjamLengkap = kunciPinjaman(dasar).map((k) => k.kunci);
    expect(pinjamLengkap.some((k) => k.includes("ringkas"))).toBe(false);
  });
});

// ============================================================================
// C. Rute perkara-saya: serentak terbatas tanpa gelombang
// ============================================================================
describe("C. jalankanBerbatas", () => {
  it("paling banyak `batas` serentak, potongan berikut dimulai begitu satu selesai (tidak menunggu yang terlambat)", async () => {
    const { jalankanBerbatas } = await import("@/app/api/aleta-ecourt/perkara-saya/susun");
    let jalan = 0;
    let puncak = 0;
    const mulai: number[] = [];
    const t0 = Date.now();
    // Potongan 0 lambat (120 ms), lainnya 10 ms: cara gelombang membuat potongan 4-7 menunggu potongan 0.
    const hasil = await jalankanBerbatas(Array.from({ length: 8 }, (_, i) => i), 4, async (i) => {
      jalan += 1;
      puncak = Math.max(puncak, jalan);
      mulai[i] = Date.now() - t0;
      await new Promise((r) => setTimeout(r, i === 0 ? 120 : 10));
      jalan -= 1;
      return i * 10;
    });
    expect(hasil).toEqual([0, 10, 20, 30, 40, 50, 60, 70]);
    expect(puncak).toBe(4);
    // Potongan 4 dimulai jauh sebelum potongan 0 selesai.
    expect(mulai[4]).toBeLessThan(100);
  });

  it("berhenti: butir yang belum dimulai tidak dijalankan; yang berjalan ditunggu", async () => {
    const { jalankanBerbatas } = await import("@/app/api/aleta-ecourt/perkara-saya/susun");
    const dijalankan: number[] = [];
    const hasil = await jalankanBerbatas(
      Array.from({ length: 10 }, (_, i) => i),
      2,
      async (i) => {
        dijalankan.push(i);
        await new Promise((r) => setTimeout(r, 5));
        return { ok: i !== 1 };
      },
      (h) => !h.ok
    );
    expect(hasil[1]).toEqual({ ok: false });
    expect(dijalankan.length).toBeLessThan(10);
    expect(hasil.slice(dijalankan.length)).toEqual(new Array(10 - dijalankan.length).fill(undefined));
  });
});

const rute = vi.hoisted(() => ({
  diminta: [] as Array<Record<string, unknown>>,
  serentak: 0,
  puncak: 0,
  jawab: ((_p: { dari: string }) => ({ ok: true, data: { sidang: [] as unknown[] } })) as (p: { dari: string }) => { ok: boolean; data?: { sidang: unknown[] }; error?: string },
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => ({ name: "Hakim Rekaan Satu", roleId: "hakim" }) }));
vi.mock("@/lib/permissions", () => ({ isPrivilegedAdmin: () => false }));
vi.mock("@/lib/waktu-pengadilan", () => ({ waktuPengadilan: () => ({ tanggal: "2099-03-01", jam: "09:00:00" }) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewayJadwalSidang: async (p: Record<string, unknown> & { dari: string }) => {
    rute.diminta.push(p);
    rute.serentak += 1;
    rute.puncak = Math.max(rute.puncak, rute.serentak);
    await new Promise((r) => setTimeout(r, 5));
    rute.serentak -= 1;
    return rute.jawab(p);
  },
}));

describe("C. rute perkara-saya - jadwal ringkas, serentak terbatas", () => {
  beforeEach(() => {
    rute.diminta = [];
    rute.serentak = 0;
    rute.puncak = 0;
  });
  const barisRekaan = (dari: string) => ({ sidangId: `s${dari}`, perkaraId: "9001", nomorPerkara: "101/Pdt.G/2099/PA.Uji", tanggalSidang: dari, majelisNama: "Hakim Rekaan Satu", pihak: { penggugat: ["P Rekaan"], tergugat: ["T Rekaan"] } });

  async function jalankan(kueri: string) {
    const mod = await import("@/app/api/aleta-ecourt/perkara-saya/route");
    const r = await mod.GET({ nextUrl: new URL(`http://uji.local/api/aleta-ecourt/perkara-saya${kueri}`) } as unknown as Parameters<typeof mod.GET>[0]);
    return { status: r.status, isi: (await r.json()) as { ok: boolean; alasan?: string; data?: { perkara: Array<{ sidang: unknown[] }> } } };
  }

  it("'semua': 20 potongan ringkas, paling banyak 4 serentak, seluruhnya tergabung", async () => {
    rute.jawab = ({ dari }) => ({ ok: true, data: { sidang: [barisRekaan(dari)] } });
    const r = await jalankan("?mode=semua");
    expect(r.status).toBe(200);
    expect(rute.diminta.length).toBe(20);
    expect(rute.diminta.every((p) => p.bidang === "ringkas" && p.batas === 500)).toBe(true);
    expect(rute.puncak).toBe(4);
    expect(r.isi.data!.perkara[0].sidang.length).toBe(20);
  });

  it("satu potongan gagal tetap 502 dengan sebabnya; potongan sesudahnya tidak semuanya dibaca", async () => {
    rute.jawab = ({ dari }) => (dari === "2098-12-29" ? { ok: false, error: "Bot rekaan tidak terjangkau" } : { ok: true, data: { sidang: [barisRekaan(dari)] } });
    const r = await jalankan("?mode=semua");
    expect(r.status).toBe(502);
    expect(r.isi.alasan).toBe("Bot rekaan tidak terjangkau");
    expect(rute.diminta.length).toBeLessThan(20);
  });
});
