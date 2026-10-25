// @vitest-environment node
/**
 * ============================================================================
 * JADWAL SIDANG DARI CERMIN + K1 TAHAP 1 (A4, 25 Okt 2026)
 * ============================================================================
 *
 *   A. urutan baris dari cermin = ORDER BY SQL jalur lama (dibandingkan dengan pembanding
 *      yang ditulis terpisah); keputusan "boleh dari cermin" (saklar, pencarian, jendela panas);
 *   B. kesegaran: segar hanya bila pemindaian selesai + pembaruan baru-baru ini;
 *   C. UJI PERBANDINGAN: untuk data rekaan yang sama, isi dari cermin = isi dari jalur lama
 *      (sidang, antrian, waktu antrian, dari/sampai) - lewat getGatewayJadwalSidangSinggah
 *      yang dipakai Jadwal Sidang, /jadwal, layar publik, dan antrean;
 *   D. kembali ke SIPP (jalur lama) bila saklar mati, cermin tertinggal, rentang di luar jendela
 *      panas, ada pencarian, atau bot lama tanpa rute pelengkap; tulisan sendiri langsung terbaca;
 *   E. bot jadwalPelengkapService menyusun keterangan langsung dengan bentuk rute lama;
 *   F. K1 tahap 1: bacaan ringan dan disidang dibagi semua perangkat, dibuang oleh tulisan;
 *   G. layar menampilkan tanda "Cermin · diperbarui hh:mm".
 *
 * Data rekaan saja. Tidak ada jaringan dan tidak ada SIPP sungguhan.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PENGATURAN_CERMIN_BAWAAN, keadaanPemindaiAwal, type PengaturanCermin } from "@/lib/cermin";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { getGatewayJadwalSidangSinggah } from "@/server/modules/aleta-bot/jadwal-sidang-singgah";
import { RUANG_SINGGAH } from "@/server/modules/aleta-bot/singgah-tulisan";
import type { BotCerminLengkap, SidangSumber } from "@/server/modules/cermin/bot";
import {
  bacaJadwalDariCermin,
  bolehDariCermin,
  urutanSidang,
  type DepsJadwalCermin,
  type PelengkapJadwal,
} from "@/server/modules/cermin/jadwal-cermin";
import { KUNCI_JEJAK, tulisJejak } from "@/server/modules/cermin/jejak";
import { buangSinggahKesegaran, kesegaranCermin } from "@/server/modules/cermin/kesegaran";
import { aturUlangPembaruanCermin, segarkanSegera } from "@/server/modules/cermin/pembaruan";
import { buangSinggahPengaturanCermin } from "@/server/modules/cermin/pengaturan";
import { simpanJendelaSidang } from "@/server/modules/cermin/penyimpan";
import { aturTulisCerminTerakhir } from "@/server/modules/cermin/setelah-tulisan";
import { tandaiTulisan } from "@/server/shared/singgah-singkat";

const AKAR = path.resolve(__dirname, "../../..");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const muatBot = createRequire(path.join(AKAR, "aleta_bot/package.json"));

let dbRute: AletaDatabase | null = null;
let aktor: string | null = "usr-super";
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => dbRute };
});

// ============================================================================
// Data rekaan: baris sidang seperti keluaran daftarSidang, sengaja dengan kunci urut yang sulit
// ============================================================================
const HARI = "2026-10-25"; // Minggu; jam sistem diatur di bawah
type Baris = Record<string, unknown> & { sidangId: string; perkaraId: string; nomorPerkara: string; tanggalSidang: string; jamSidang: string; alurPerkaraId: number };

function baris(id: number, perkaraId: number, nomor: string, tanggal: string, jam: string, alur: number, lebih: Record<string, unknown> = {}): Baris {
  return {
    sidangId: String(id),
    perkaraId: String(perkaraId),
    nomorPerkara: nomor,
    tanggalSidang: tanggal,
    jamSidang: jam,
    alurPerkaraId: alur,
    jenisPerkara: "Cerai Talak",
    agenda: "Pembuktian",
    ruangan: "Ruang Sidang 1",
    ditunda: "T",
    pihak: { penggugat: ["Rekaan A"], tergugat: ["Rekaan B"] },
    saksiPihak1: 1,
    kumulasi: null,
    penandaPerkara: { ghaib: false, prodeo: false },
    ...lebih,
  } as Baris;
}

/** Himpunan rekaan: nomor "186" sebelum "1000" (angka), alur 15 sebelum 16 sebelum lainnya, jam, dan tanggal. */
const REKAAN: Baris[] = [
  baris(1, 101, "1000/Pdt.G/2026/PA.Rekaan", HARI, "09:00:00", 15),
  baris(2, 102, "186/Pdt.G/2026/PA.Rekaan", HARI, "09:00:00", 15),
  baris(3, 103, "50/Pdt.P/2026/PA.Rekaan", HARI, "09:00:00", 16),
  baris(4, 104, "7/Pdt.G.S/2026/PA.Rekaan", HARI, "09:00:00", 17),
  baris(5, 105, "9/JN/2026/PA.Rekaan", HARI, "09:00:00", 122),
  baris(6, 106, "3/Pdt.X/2026/PA.Rekaan", HARI, "09:00:00", 99),
  baris(7, 107, "2/Pdt.G/2026/PA.Rekaan", HARI, "08:30:00", 15),
  baris(8, 108, "12/Pdt.G/2026/PA.Rekaan", "2026-10-26", "09:00:00", 15),
  baris(9, 109, "12/Pdt.G/2026/PB.Rekaan", "2026-10-26", "09:00:00", 15), // nomor angka sama, teks beda
  baris(10, 110, "400/Pdt.G/2026/PA.Rekaan", "2026-10-24", "10:00:00", 16),
];

/** Pembanding ORDER BY jalur lama, ditulis terpisah dari urutanSidang: tuple kunci. */
function urutanAcuan(daftar: Baris[]): Baris[] {
  const kunci = (b: Baris) => [
    b.tanggalSidang,
    b.jamSidang,
    ({ 15: 1, 16: 2, 17: 3, 122: 4 } as Record<number, number>)[b.alurPerkaraId] ?? 5,
    Number.parseInt(b.nomorPerkara.split("/")[0], 10),
    b.nomorPerkara,
  ];
  return [...daftar].sort((a, b) => {
    const ka = kunci(a);
    const kb = kunci(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
    return 0;
  });
}

const ANTRIAN = { terbaca: true, alasan: "", tanggal: [HARI], peta: { "101": { nomor: 3, tanggalSidang: HARI } }, kehadiran: { [`101|${HARI}`]: { hadir: [], pertama: null } } };
const WAKTU = { terbaca: true, alasan: "", sekarang: "2026-10-25 22:00:00", hariIni: HARI, langsungTerbaca: true, rekamanTerbaca: true, baris: [] };

// ============================================================================
// A. urutan dan keputusan
// ============================================================================
describe("A. urutan baris dan keputusan boleh-dari-cermin", () => {
  it("urutanSidang = ORDER BY jalur lama: tanggal, jam, alur, nomor sebagai ANGKA, nomor sebagai teks", () => {
    const acak = [...REKAAN].reverse();
    expect(acak.sort(urutanSidang).map((b) => b.sidangId)).toEqual(urutanAcuan(REKAAN).map((b) => b.sidangId));
    const urut = [...REKAAN].sort(urutanSidang).map((b) => b.nomorPerkara);
    // Pada hari yang sama, jam 09.00, alur 15: "186" sebelum "1000" (angka, bukan teks).
    expect(urut.indexOf("186/Pdt.G/2026/PA.Rekaan")).toBeLessThan(urut.indexOf("1000/Pdt.G/2026/PA.Rekaan"));
    // Nomor angka sama: teks menentukan (PA < PB).
    expect(urut.indexOf("12/Pdt.G/2026/PA.Rekaan")).toBeLessThan(urut.indexOf("12/Pdt.G/2026/PB.Rekaan"));
  });

  const sekarang = new Date("2026-10-25T14:00:00Z"); // 22.00 WITA 25 Okt
  const nyala: PengaturanCermin = { ...PENGATURAN_CERMIN_BAWAAN, layar: { ...PENGATURAN_CERMIN_BAWAAN.layar, jadwal: true } };

  it("saklar jadwal MATI (bawaan) -> tidak boleh, apa pun yang lain", () => {
    expect(bolehDariCermin({ dari: HARI, sampai: HARI }, PENGATURAN_CERMIN_BAWAAN, sekarang)).toEqual({ boleh: false, alasan: "saklar-mati" });
  });

  it("pencarian, rentang tidak sah, dan di luar jendela panas -> tidak boleh", () => {
    expect(bolehDariCermin({ dari: HARI, sampai: HARI, cari: "Dirman" }, nyala, sekarang)).toEqual({ boleh: false, alasan: "ada-pencarian" });
    expect(bolehDariCermin({ dari: HARI, sampai: HARI, cari: "   " }, nyala, sekarang)).toMatchObject({ boleh: true });
    expect(bolehDariCermin({ dari: "", sampai: "" }, nyala, sekarang)).toEqual({ boleh: false, alasan: "rentang-tidak-sah" });
    expect(bolehDariCermin({ dari: "2026-10-26", sampai: "2026-10-25" }, nyala, sekarang)).toEqual({ boleh: false, alasan: "rentang-tidak-sah" });
    // Jendela panas bawaan: 24 Okt .. 1 Nov.
    expect(bolehDariCermin({ dari: "2026-10-23", sampai: "2026-10-24" }, nyala, sekarang)).toEqual({ boleh: false, alasan: "di-luar-jendela-panas" });
    expect(bolehDariCermin({ dari: "2026-10-31", sampai: "2026-11-02" }, nyala, sekarang)).toEqual({ boleh: false, alasan: "di-luar-jendela-panas" });
    expect(bolehDariCermin({ dari: "2026-10-24", sampai: "2026-11-01" }, nyala, sekarang)).toEqual({ boleh: true, dari: "2026-10-24", sampai: "2026-11-01" });
    expect(bolehDariCermin({ dari: HARI }, nyala, sekarang)).toEqual({ boleh: true, dari: HARI, sampai: HARI });
  });
});

// ============================================================================
// Perlengkapan: basis data, jam, bot HTTP palsu
// ============================================================================
const SEKARANG_MS = Date.parse("2026-10-25T14:00:00Z");
let db: AletaDatabase;
let pengaturan: PengaturanCermin;
let jam = SEKARANG_MS;
let panggilanBot: string[] = [];
let pelengkapStatus = 200;

function pasangPengaturan(p: Partial<PengaturanCermin> & { jadwal?: boolean }) {
  pengaturan = {
    ...PENGATURAN_CERMIN_BAWAAN,
    layar: { ...PENGATURAN_CERMIN_BAWAAN.layar, jadwal: p.jadwal ?? false },
    pemindaiAktif: true,
    ...p,
  };
}

async function simpanPengaturanDb() {
  await db
    .prepare("INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?, ?, ?, ?) ON CONFLICT (pengguna_id, kunci) DO UPDATE SET nilai = excluded.nilai")
    .run("*sistem*", "sistem:cermin-perkara", JSON.stringify(pengaturan), "x");
  buangSinggahPengaturanCermin();
  buangSinggahKesegaran();
}

async function cerminSegar(opsi: { umurPutaranDetik?: number; selesai?: boolean; galat?: number } = {}) {
  const k = keadaanPemindaiAwal();
  if (opsi.selesai !== false) {
    k.status = "selesai";
    k.tahap = "selesai";
    k.mulaiPada = new Date(jam - 3_600_000).toISOString();
    k.sidang.awal = "2026-10-01";
    k.sidang.akhir = "2026-11-30";
  }
  await tulisJejak(db, KUNCI_JEJAK.pemindai, k);
  const putaran = new Date(jam - (opsi.umurPutaranDetik ?? 20) * 1000).toISOString();
  await tulisJejak(db, KUNCI_JEJAK.pembaruan, {
    tanda: "2026-10-25 21:59:00",
    putaranTerakhir: putaran,
    panasTerakhir: putaran,
    antrianTanggal: [],
    terakhir: null,
    galat: { terakhir: opsi.galat ? "x" : "", pada: "", beruntun: opsi.galat ?? 0 },
    tidakTerbaca: [],
  });
  buangSinggahKesegaran();
}

async function isiCermin(daftar: Baris[]) {
  const sidang: SidangSumber[] = daftar.map((b) => ({
    sidangId: b.sidangId,
    perkaraId: b.perkaraId,
    tanggalSidang: b.tanggalSidang,
    jamSidang: b.jamSidang,
    ruangan: String(b.ruangan),
    agenda: String(b.agenda),
    ditunda: 0,
    sippDiperbarui: "2026-10-25 21:00:00",
    baris: b,
  }));
  await simpanJendelaSidang(db, { sidang }, new Date(jam).toISOString());
}

/** Bot HTTP palsu: jalur lama (/sipp/jadwal-sidang) dan rute cermin (/cermin/pelengkap-jadwal). */
function pasangBotPalsu(sumber: Baris[]) {
  panggilanBot = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (masuk: string) => {
      const url = new URL(String(masuk));
      panggilanBot.push(url.pathname + url.search);
      const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
      if (url.pathname.endsWith("/sipp/jadwal-sidang")) {
        const dari = url.searchParams.get("dari") || HARI;
        const sampai = url.searchParams.get("sampai") || dari;
        const batas = Math.min(Math.max(Number(url.searchParams.get("batas")) || 200, 1), 500);
        const daftar = urutanAcuan(sumber.filter((b) => b.tanggalSidang >= dari && b.tanggalSidang <= sampai)).slice(0, batas);
        const waktu = url.searchParams.get("waktu") === "1";
        return json({
          ok: true,
          dari,
          sampai,
          diperiksaPada: "2026-10-25T14:00:00.000Z",
          sidang: daftar,
          antrian: waktu ? ANTRIAN : { ...ANTRIAN, kehadiran: undefined },
          ...(waktu ? { waktuAntrian: WAKTU } : {}),
        });
      }
      if (url.pathname.endsWith("/cermin/pelengkap-jadwal")) {
        if (pelengkapStatus === 404) return new Response("<html>404</html>", { status: 404 });
        if (pelengkapStatus === 500) return json({ ok: false, error: "antrian mati" }, 500);
        const waktu = url.searchParams.get("waktu") === "1";
        return json({ ok: true, antrian: waktu ? ANTRIAN : { ...ANTRIAN, kehadiran: undefined }, ...(waktu ? { waktuAntrian: WAKTU } : {}) });
      }
      return json({ ok: true });
    })
  );
}
const keLama = () => panggilanBot.filter((p) => p.includes("/sipp/jadwal-sidang")).length;
const keCermin = () => panggilanBot.filter((p) => p.includes("/cermin/")).length;

beforeEach(async () => {
  dbRute = db = await createAletaDatabase({ useInMemory: true, seed: true });
  aktor = "usr-super";
  jam = SEKARANG_MS;
  pelengkapStatus = 200;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(jam);
  process.env.ALETA_CERMIN_JADWAL_UJI = "1";
  process.env.ALETA_SINGGAH_JADWAL_MS = "0";
  aturUlangPembaruanCermin();
  aturTulisCerminTerakhir(0);
  buangSinggahPengaturanCermin();
  buangSinggahKesegaran();
  tandaiTulisan();
});
afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.ALETA_CERMIN_JADWAL_UJI;
  delete process.env.ALETA_SINGGAH_JADWAL_MS;
  delete process.env.ALETA_SINGGAH_RINGAN_MS;
  delete process.env.ALETA_SINGGAH_DISIDANG_MS;
  aturUlangPembaruanCermin();
  aturTulisCerminTerakhir(0);
  await db.close();
  dbRute = null;
});

// ============================================================================
// B. kesegaran
// ============================================================================
describe("B. kesegaran cermin", () => {
  const sekarang = () => new Date(jam);
  beforeEach(() => pasangPengaturan({ jadwal: true }));

  it("belum ada pemindaian / pembaruan -> tidak segar, dengan sebab", async () => {
    const a = await kesegaranCermin(db, pengaturan, sekarang(), { tanpaSinggah: true });
    expect(a).toMatchObject({ segar: false, alasan: "pemindaian awal belum selesai" });
    await cerminSegar({ selesai: true });
    await db.run("DELETE FROM aleta_cermin_jejak WHERE kunci = 'pembaruan'");
    expect((await kesegaranCermin(db, pengaturan, sekarang(), { tanpaSinggah: true })).alasan).toBe("pembaruan berkala belum pernah berputar");
  });

  it("segar: pemindaian selesai + putaran dan jendela panas baru-baru ini; tanda waktu = jendela panas terakhir", async () => {
    await cerminSegar({ umurPutaranDetik: 30 });
    const k = await kesegaranCermin(db, pengaturan, sekarang(), { tanpaSinggah: true });
    expect(k.segar).toBe(true);
    expect(k.diperbaruiPada).toBe(new Date(jam - 30_000).toISOString());
    expect(k.umurDetik).toBe(30);
  });

  it("tertinggal: putaran lebih tua dari 5 menit, atau tiga galat beruntun", async () => {
    await cerminSegar({ umurPutaranDetik: 400 });
    expect((await kesegaranCermin(db, pengaturan, sekarang(), { tanpaSinggah: true })).alasan).toContain("pembaruan terakhir 400 detik lalu");
    await cerminSegar({ umurPutaranDetik: 10, galat: 3 });
    expect((await kesegaranCermin(db, pengaturan, sekarang(), { tanpaSinggah: true })).alasan).toBe("pembaruan gagal 3x beruntun");
  });

  it("jejak tak terbaca -> tidak segar (bukan melempar)", async () => {
    const rusak = { queryAll: async () => { throw new Error("db mati"); } } as unknown as AletaDatabase;
    expect(await kesegaranCermin(rusak, pengaturan, sekarang(), { tanpaSinggah: true })).toMatchObject({ segar: false, alasan: "keadaan cermin tidak terbaca" });
  });
});

// ============================================================================
// C. UJI PERBANDINGAN: isi dari cermin = isi dari jalur lama
// ============================================================================
describe("C. uji perbandingan cermin vs jalur lama (data rekaan yang sama)", () => {
  async function ambil(p: Parameters<typeof getGatewayJadwalSidangSinggah>[0]) {
    const h = await getGatewayJadwalSidangSinggah(p);
    if (!h.ok) throw new Error(h.error);
    return h.data as unknown as Record<string, any>;
  }

  it("layar Jadwal (waktu) hari ini: sidang, antrian, waktu antrian, dari/sampai SAMA; hanya cermin yang bertanda", async () => {
    pasangBotPalsu(REKAAN);
    await cerminSegar();
    await isiCermin(REKAAN);
    const p = { dari: HARI, sampai: HARI, cari: "", batas: 200, waktu: true };

    pasangPengaturan({ jadwal: false });
    await simpanPengaturanDb();
    const lama = await ambil(p);
    expect(keLama()).toBe(1);
    expect(keCermin()).toBe(0);
    expect(lama.cermin).toBeUndefined();

    pasangPengaturan({ jadwal: true });
    await simpanPengaturanDb();
    panggilanBot = [];
    const baru = await ambil(p);
    expect(keLama()).toBe(0); // SIPP tidak ditanya sama sekali untuk daftar sidangnya
    expect(keCermin()).toBe(1); // hanya keterangan langsung
    expect(baru.sidang).toEqual(lama.sidang);
    expect(baru.sidang.map((b: Baris) => b.sidangId)).toEqual(["7", "2", "1", "3", "4", "5", "6"]);
    expect(baru.antrian).toEqual(lama.antrian);
    expect(baru.waktuAntrian).toEqual(lama.waktuAntrian);
    expect(baru.dari).toBe(lama.dari);
    expect(baru.sampai).toBe(lama.sampai);
    expect(baru.cermin).toEqual({ diperbaruiPada: new Date(jam - 20_000).toISOString() });
  });

  it("rentang beberapa hari dalam jendela panas, tanpa waktu (layar publik): isi sama, urutan sama", async () => {
    pasangBotPalsu(REKAAN);
    await cerminSegar();
    await isiCermin(REKAAN);
    const p = { dari: "2026-10-24", sampai: "2026-10-26", cari: "", batas: 50, waktu: false };

    pasangPengaturan({ jadwal: false });
    await simpanPengaturanDb();
    const lama = await ambil(p);
    pasangPengaturan({ jadwal: true });
    await simpanPengaturanDb();
    const baru = await ambil(p);
    expect(baru.sidang).toEqual(lama.sidang);
    expect(baru.sidang.map((b: Baris) => b.sidangId)).toEqual(["10", "7", "2", "1", "3", "4", "5", "6", "8", "9"]);
    expect(baru.antrian).toEqual(lama.antrian);
    expect(baru.waktuAntrian).toBeUndefined();
    expect(lama.waktuAntrian).toBeUndefined();
  });

  it("batas dihormati seperti LIMIT jalur lama", async () => {
    pasangBotPalsu(REKAAN);
    await cerminSegar();
    await isiCermin(REKAAN);
    const p = { dari: "2026-10-24", sampai: "2026-10-26", cari: "", batas: 4, waktu: false };
    pasangPengaturan({ jadwal: false });
    await simpanPengaturanDb();
    const lama = await ambil(p);
    pasangPengaturan({ jadwal: true });
    await simpanPengaturanDb();
    const baru = await ambil(p);
    expect(baru.sidang).toHaveLength(4);
    expect(baru.sidang).toEqual(lama.sidang);
  });

  it("perubahan di SIPP yang sudah masuk cermin (agenda diganti) tampil sama di kedua jalur", async () => {
    const berubah = REKAAN.map((b) => (b.sidangId === "2" ? { ...b, agenda: "Putusan", ditunda: "Y" } : b));
    pasangBotPalsu(berubah);
    await cerminSegar();
    await isiCermin(REKAAN); // cermin lama...
    await isiCermin(berubah); // ...lalu pembaruan memasukkan perubahan
    const p = { dari: HARI, sampai: HARI, cari: "", batas: 200, waktu: true };
    pasangPengaturan({ jadwal: false });
    await simpanPengaturanDb();
    const lama = await ambil(p);
    pasangPengaturan({ jadwal: true });
    await simpanPengaturanDb();
    const baru = await ambil(p);
    expect(baru.sidang).toEqual(lama.sidang);
    expect((baru.sidang as Baris[]).find((b) => b.sidangId === "2")).toMatchObject({ agenda: "Putusan", ditunda: "Y" });
  });
});

// ============================================================================
// D. kembali ke SIPP
// ============================================================================
describe("D. kembali ke SIPP (jalur lama) dan baca-tulisan-sendiri", () => {
  const p = { dari: HARI, sampai: HARI, cari: "", batas: 200, waktu: true };
  async function ambil(masukan: typeof p) {
    const h = await getGatewayJadwalSidangSinggah(masukan);
    if (!h.ok) throw new Error(h.error);
    return h.data as unknown as Record<string, any>;
  }
  async function siap(umur = 20) {
    pasangBotPalsu(REKAAN);
    await cerminSegar({ umurPutaranDetik: umur });
    await isiCermin(REKAAN);
    pasangPengaturan({ jadwal: true });
    await simpanPengaturanDb();
  }

  it("cermin tertinggal (pembaruan macet 20 menit): jalur lama, tanpa tanda cermin", async () => {
    await siap(1200);
    const h = await ambil(p);
    expect(keLama()).toBe(1);
    expect(keCermin()).toBe(0);
    expect(h.cermin).toBeUndefined();
    expect(h.sidang).toHaveLength(7);
  });

  it("pemindaian awal belum selesai: jalur lama", async () => {
    pasangBotPalsu(REKAAN);
    await cerminSegar({ selesai: false });
    pasangPengaturan({ jadwal: true });
    await simpanPengaturanDb();
    await ambil(p);
    expect(keLama()).toBe(1);
  });

  it("ada pencarian atau rentang di luar jendela panas: jalur lama", async () => {
    await siap();
    await ambil({ ...p, cari: "Rekaan A" });
    expect(keLama()).toBe(1);
    panggilanBot = [];
    await ambil({ ...p, dari: "2026-09-01", sampai: "2026-09-30" });
    expect(keLama()).toBe(1);
    expect(keCermin()).toBe(0);
  });

  it("saklar jadwal mati: tidak ada satu pun panggilan ke rute cermin, tidak ada pembacaan tabel cermin", async () => {
    await siap();
    pasangPengaturan({ jadwal: false });
    await simpanPengaturanDb();
    panggilanBot = [];
    const h = await ambil(p);
    expect(keLama()).toBe(1);
    expect(keCermin()).toBe(0);
    expect(h.cermin).toBeUndefined();
  });

  it("bot lama tanpa rute pelengkap (404): jalur lama; galat lain pada pelengkap: jadwal tetap dari cermin, antrian tak terbaca", async () => {
    await siap();
    pelengkapStatus = 404;
    const a = await ambil(p);
    expect(keLama()).toBe(1);
    expect(a.cermin).toBeUndefined();
    panggilanBot = [];
    pelengkapStatus = 500;
    const b = await ambil(p);
    expect(keLama()).toBe(0);
    expect(b.cermin).toBeDefined();
    expect(b.sidang).toHaveLength(7);
    expect(b.antrian).toMatchObject({ terbaca: false, peta: {}, tanggal: [] });
    expect(String(b.antrian.alasan)).toContain("antrian mati");
  });

  it("BACA TULISAN SENDIRI: sesudah tulisan lewat ALETA, jalur lama dipakai sampai cermin menyusul", async () => {
    await siap();
    // Cermin dipakai lebih dulu.
    await ambil(p);
    expect(keLama()).toBe(0);
    // Tulisan terjadi SEKARANG; jendela panas terakhir dihitung SEBELUMNYA.
    aturTulisCerminTerakhir(Date.now() + 1);
    panggilanBot = [];
    const sesudahTulis = await ambil(p);
    expect(keLama()).toBe(1);
    expect(sesudahTulis.cermin).toBeUndefined();
    // Pembaruan (dipicu tulisan itu sendiri) menghitung ulang jendela panas SESUDAH tulisan -> cermin dipakai lagi.
    vi.setSystemTime(jam + 2000);
    const bot: BotCerminLengkap = {
      ringkasan: async () => ({ ok: false, error: "x" }),
      perkara: async () => ({ ok: false, error: "x" }),
      perkaraId: async () => ({ ok: true, data: { perkara: [] } }),
      perubahan: async (sejak) => ({ ok: true, data: { sejak, tandaBaru: sejak, terpotong: false, jumlahTersentuh: 0, perkaraId: [], tanggalSidang: [], tidakTerbaca: [] } }),
      idPerkara: async () => ({ ok: false, error: "x" }),
      idSidang: async () => ({ ok: false, error: "x" }),
      sidang: async (dari, sampai) => ({
        ok: true,
        data: {
          dari,
          sampai,
          terpotong: false,
          sidang: REKAAN.filter((b) => b.tanggalSidang >= dari && b.tanggalSidang <= sampai).map((b) => ({
            sidangId: b.sidangId,
            perkaraId: b.perkaraId,
            tanggalSidang: b.tanggalSidang,
            jamSidang: b.jamSidang,
            ruangan: "Ruang Sidang 1",
            agenda: "Pembuktian",
            ditunda: 0,
            sippDiperbarui: "2026-10-25 21:00:00",
            baris: b,
          })),
        },
      }),
    };
    const r = await segarkanSegera([], { db: async () => db, bot, pengaturan: async () => pengaturan, sekarang: () => new Date(Date.now()) });
    expect(r.alasan).toBe("ok");
    buangSinggahKesegaran();
    panggilanBot = [];
    const sesudahMenyusul = await ambil(p);
    expect(keLama()).toBe(0);
    expect(sesudahMenyusul.cermin).toBeDefined();
  });

  it("bacaJadwalDariCermin mencatat sebab dan tidak pernah melempar (basis data rusak -> null)", async () => {
    const alasan: string[] = [];
    const rusak: DepsJadwalCermin = {
      db: async () => {
        throw new Error("db mati");
      },
      pengaturan: async () => ({ ...PENGATURAN_CERMIN_BAWAAN, layar: { ...PENGATURAN_CERMIN_BAWAAN.layar, jadwal: true } }),
      sekarang: () => new Date(jam),
      pelengkap: async (): Promise<PelengkapJadwal> => ({ ok: true, data: { antrian: {} } }),
    };
    expect(await bacaJadwalDariCermin(p, rusak, (a) => alasan.push(a))).toBeNull();
    expect(alasan).toEqual(["galat"]);
  });
});

// ============================================================================
// E. bot: jadwalPelengkapService
// ============================================================================
describe("E. bot - jadwalPelengkapService", () => {
  type Pelengkap = { pelengkapJadwal: (m: Record<string, unknown>, d: Record<string, unknown>) => Promise<Record<string, any>> };
  const layanan = (): Pelengkap => {
    const jalur = muatBot.resolve("./services/jadwalPelengkapService.js");
    delete (muatBot.cache as Record<string, unknown>)[jalur];
    return muatBot(jalur) as Pelengkap;
  };
  const sidang = [
    { perkaraId: "101", tanggalSidang: HARI },
    { perkaraId: "102", tanggalSidang: HARI },
    { perkaraId: "101", tanggalSidang: "2026-10-26" },
  ];
  const palsu = (ubah: Record<string, unknown> = {}) => ({
    antrianSidangService: {
      petaAntrian: async () => ({ terbaca: true, alasan: "", peta: { "101": { nomor: 1 }, "999": { nomor: 9 } }, tanggal: [HARI] }),
      saringUntukPerkara: (peta: { peta: Record<string, unknown> }, id: string[]) => ({
        ...peta,
        peta: Object.fromEntries(Object.entries(peta.peta).filter(([k]) => id.map(String).includes(k))),
      }),
    },
    antrianWaktuService: { waktuUntukJadwal: async (m: Record<string, unknown>) => ({ terbaca: true, tanggalDiminta: m.tanggal, petaNomorAda: Boolean(m.petaNomor), baris: [] }) },
    kehadiranAntrianService: { daftarKehadiran: async (id: string[], hari: string) => Object.fromEntries(id.map((x) => [x, { hadir: [], hari }])) },
    ...ubah,
  });

  it("tanpa waktu: hanya antrian yang disaring ke perkara yang tampil", async () => {
    const r = await layanan().pelengkapJadwal({ baris: sidang, waktu: false }, palsu());
    expect(r.ok).toBe(true);
    expect(Object.keys(r.antrian.peta)).toEqual(["101"]);
    expect(r.antrian.kehadiran).toBeUndefined();
    expect(r.waktuAntrian).toBeUndefined();
  });

  it("dengan waktu: kehadiran dikunci 'perkaraId|tanggal' dan waktuAntrian disusun dari tanggal baris + peta nomor", async () => {
    const r = await layanan().pelengkapJadwal({ baris: sidang, waktu: true }, palsu());
    expect(Object.keys(r.antrian.kehadiran).sort()).toEqual([`101|${HARI}`, "101|2026-10-26", `102|${HARI}`]);
    expect(r.antrian.kehadiran[`101|${HARI}`]).toMatchObject({ hari: HARI });
    expect(r.waktuAntrian).toMatchObject({ terbaca: true, petaNomorAda: true });
    expect(r.waktuAntrian.tanggalDiminta).toEqual([HARI, HARI, "2026-10-26"]);
  });

  it("gagal sebagian ditelan seperti rute lama: peta antrian gagal -> terbaca false; satu tanggal kehadiran gagal -> tanggal lain tetap; waktu gagal -> bentuk kosong", async () => {
    const r = await layanan().pelengkapJadwal(
      { baris: sidang, waktu: true },
      palsu({
        antrianSidangService: {
          petaAntrian: async () => {
            throw new Error("aplikasi antrian mati");
          },
          saringUntukPerkara: (peta: Record<string, unknown>) => peta,
        },
        antrianWaktuService: {
          waktuUntukJadwal: async () => {
            throw new Error("buku waktu mati");
          },
        },
        kehadiranAntrianService: {
          daftarKehadiran: async (id: string[], hari: string) => {
            if (hari === "2026-10-26") throw new Error("tabel kehadiran");
            return Object.fromEntries(id.map((x) => [x, { hadir: [] }]));
          },
        },
      })
    );
    expect(r.ok).toBe(true);
    expect(r.antrian).toMatchObject({ terbaca: false, peta: {}, tanggal: [] });
    expect(String(r.antrian.alasan)).toContain("aplikasi antrian mati");
    expect(Object.keys(r.antrian.kehadiran).sort()).toEqual([`101|${HARI}`, `102|${HARI}`]);
    expect(r.waktuAntrian).toMatchObject({ terbaca: false, baris: [] });
    expect(String(r.waktuAntrian.alasan)).toContain("buku waktu mati");
  });

  it("rute /cermin/pelengkap-jadwal: GET, wajib token, baris tak sah dibuang; layanan tidak menulis apa pun", () => {
    const rute = baca("aleta_bot/routes/cerminRoutes.js");
    expect(rute).toContain('router.get("/pelengkap-jadwal", wajibToken');
    expect(rute).toContain("jadwalPelengkapService.pelengkapJadwal");
    const kode = baca("aleta_bot/services/jadwalPelengkapService.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(kode).not.toMatch(/\b(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP)\b/);
  });
});

// ============================================================================
// F. K1 tahap 1 - bacaan ringan dan disidang dibagi semua perangkat
// ============================================================================
type Hasil = { status: number; isi: { ok: boolean; data: Record<string, any> } };
async function panggilRute(nama: "ringan" | "disidang", query = "dari=2026-10-25&sampai=2026-10-25"): Promise<Hasil> {
  const modul =
    nama === "ringan"
      ? await import("@/app/api/aleta-ecourt/sidang/ringan/route")
      : await import("@/app/api/aleta-ecourt/sidang/disidang/route");
  const jawaban = await modul.GET(new NextRequest(`http://localhost/api/x?${query}`));
  return { status: jawaban.status, isi: (await jawaban.json()) as Hasil["isi"] };
}

describe("F. K1 tahap 1: bacaan ringan dan disidang dibagi semua perangkat", () => {
  function botRingan() {
    panggilanBot = [];
    let nomor = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (masuk: string) => {
        const url = new URL(String(masuk));
        panggilanBot.push(url.pathname + url.search);
        nomor += 1;
        return new Response(JSON.stringify({ ok: true, baris: [], diperiksaPada: String(nomor), terbaca: true }), { status: 200, headers: { "content-type": "application/json" } });
      })
    );
  }
  const keRingan = () => panggilanBot.filter((p) => p.includes("/jadwal-sidang/ringan")).length;
  const keDisidang = () => panggilanBot.filter((p) => p.includes("/jadwal-sidang/disidang")).length;

  beforeEach(() => {
    process.env.ALETA_SINGGAH_RINGAN_MS = "2500";
    process.env.ALETA_SINGGAH_DISIDANG_MS = "2000";
  });

  it("seratus layar serentak = satu bacaan bot; rentang lain bertanya sendiri", async () => {
    botRingan();
    const semua = await Promise.all(Array.from({ length: 100 }, () => panggilRute("ringan")));
    expect(semua.every((h) => h.status === 200 && h.isi.data.available === true)).toBe(true);
    expect(keRingan()).toBe(1);
    await panggilRute("ringan");
    expect(keRingan()).toBe(1);
    await panggilRute("ringan", "dari=2026-10-26&sampai=2026-10-26");
    expect(keRingan()).toBe(2);
  });

  it("disidang: banyak layar dan widget = satu bacaan bot", async () => {
    botRingan();
    await Promise.all(Array.from({ length: 50 }, () => panggilRute("disidang")));
    await panggilRute("disidang");
    expect(keDisidang()).toBe(1);
  });

  it("tulisan sidang/antrian lewat ALETA membuang keduanya seketika; antrean pesan WhatsApp tidak", async () => {
    botRingan();
    await panggilRute("ringan");
    await panggilRute("disidang");
    const { terkenaTulisan } = await import("@/server/modules/aleta-bot/singgah-tulisan");
    tandaiTulisan(terkenaTulisan("/internal/aleta-bot/messages/enqueue", "{}"));
    await panggilRute("ringan");
    await panggilRute("disidang");
    expect(keRingan()).toBe(1);
    expect(keDisidang()).toBe(1);
    tandaiTulisan(terkenaTulisan("/internal/aleta-bot/sidang/tunda", "{}"));
    await panggilRute("ringan");
    await panggilRute("disidang");
    expect(keRingan()).toBe(2);
    expect(keDisidang()).toBe(2);
    tandaiTulisan(terkenaTulisan("/internal/aleta-bot/antrian/panggil", "{}", HARI));
    await panggilRute("ringan");
    await panggilRute("disidang");
    expect(keRingan()).toBe(3);
    expect(keDisidang()).toBe(3);
  });

  it("galat bot tidak disimpan; hak 'panel' tetap ditegakkan", async () => {
    panggilanBot = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (masuk: string) => {
        panggilanBot.push(String(masuk));
        return new Response(JSON.stringify({ ok: false, error: "bot sibuk" }), { status: 500, headers: { "content-type": "application/json" } });
      })
    );
    const a = await panggilRute("ringan");
    expect(a.isi.data).toMatchObject({ available: false });
    await panggilRute("ringan");
    expect(panggilanBot).toHaveLength(2); // galat tidak disinggahkan
    aktor = null;
    expect((await panggilRute("ringan")).status).toBe(401);
    expect(RUANG_SINGGAH.ringan).toBe("jadwal-ringan");
  });

  it("TTL 0 (env) mematikan penyatuan - perilaku lama", async () => {
    process.env.ALETA_SINGGAH_RINGAN_MS = "0";
    botRingan();
    await panggilRute("ringan");
    await panggilRute("ringan");
    expect(keRingan()).toBe(2);
  });
});

// ============================================================================
// G. layar
// ============================================================================
describe("G. tanda Cermin pada layar Jadwal Sidang", () => {
  const layar = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
  const rute = baca("manajemen_surat/src/app/api/aleta-ecourt/sidang/route.ts");

  it("rute meneruskan 'cermin' (null bila dari SIPP); layar menampilkan 'Cermin · diperbarui hh.mm' hanya bila ada", () => {
    expect(rute).toContain("cermin: (hasil.data as { cermin?: { diperbaruiPada: string | null } } | undefined)?.cermin ?? null");
    expect(layar).toContain("setCerminJadwal((data.cermin ?? null)");
    expect(layar).toContain('data-testid="tanda-cermin"');
    expect(layar).toContain("{cerminJadwal && !(pertamaMuat && memuat) ? (");
    expect(layar).toContain('" · Cermin · diperbarui "');
    // Waktu WITA tanpa label teknis; tidak menyebut tabel/aleta_cermin.
    expect(layar.slice(layar.indexOf('data-testid="tanda-cermin"'), layar.indexOf('data-testid="tanda-cermin"') + 700)).not.toMatch(/aleta_cermin|baris_json/);
  });
});
