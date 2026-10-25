// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { BarisRekamAntrian } from "@/lib/rekam-antrian";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { getGatewayJadwalSidangSinggah, kunciSinggahJadwal } from "@/server/modules/aleta-bot/jadwal-sidang-singgah";
import {
  getGatewayJadwalSidang,
  getGatewayTagPerkara,
  gatewayPegawaiPenunjukan,
  getGatewayKesiapanBanyak,
  getGatewayPenunjukanUsulan,
  permintaanMenulis,
  postGatewayTundaSidang,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { bacaRekamAntrian, rekamAntrian } from "@/server/modules/aleta-ecourt/rekam-antrian";
import { keadaanSinggah, singgahSingkat, tandaiTulisan } from "@/server/shared/singgah-singkat";

/**
 * ============================================================================
 * PERFORMA MUAT 19 OKT 2026 - SINGGAHAN SINGKAT, INVALIDASI, PARALEL
 * ============================================================================
 *
 * Yang dijaga: (1) permintaan serentak yang sama menunggu SATU kerja; (2)
 * umurnya berbatas; (3) tulisan membuang singgahan SEKETIKA, termasuk bacaan
 * yang sedang berjalan saat tulisan terjadi; (4) tiap pemanggil mendapat
 * salinan; (5) rekaman antrian satu transaksi; (6) rute jadwal bot membaca
 * jadwal dan antrian bersamaan.
 */

const tunda = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => tandaiTulisan());

describe("singgahSingkat", () => {
  it("permintaan serentak dengan kunci sama menjalankan kerja SEKALI", async () => {
    let jalan = 0;
    const kerja = async () => {
      jalan += 1;
      await tunda(20);
      return { n: jalan };
    };
    const hasil = await Promise.all([1, 2, 3, 4].map(() => singgahSingkat("uji", "a", 1000, kerja)));
    expect(jalan).toBe(1);
    expect(hasil.every((h) => h.n === 1)).toBe(true);
    // Dan sesudahnya, selama belum kedaluwarsa, tetap dari singgahan.
    await singgahSingkat("uji", "a", 1000, kerja);
    expect(jalan).toBe(1);
  });

  it("kedaluwarsa sesudah ttl, kunci lain tidak tercampur", async () => {
    let jam = 1_000;
    let jalan = 0;
    const kerja = async () => ++jalan;
    const pilihan = { sekarang: () => jam };
    expect(await singgahSingkat("uji", "b", 4000, kerja, pilihan)).toBe(1);
    jam += 3999;
    expect(await singgahSingkat("uji", "b", 4000, kerja, pilihan)).toBe(1);
    expect(await singgahSingkat("uji", "c", 4000, kerja, pilihan)).toBe(2);
    jam += 2;
    expect(await singgahSingkat("uji", "b", 4000, kerja, pilihan)).toBe(3);
  });

  it("ttl 0 = tanpa singgahan sama sekali", async () => {
    let jalan = 0;
    await singgahSingkat("uji", "d", 0, async () => ++jalan);
    await singgahSingkat("uji", "d", 0, async () => ++jalan);
    expect(jalan).toBe(2);
  });

  it("tandaiTulisan membuang singgahan: bacaan berikutnya ke sumber", async () => {
    let jalan = 0;
    await singgahSingkat("uji", "e", 60_000, async () => ++jalan);
    tandaiTulisan();
    expect(await singgahSingkat("uji", "e", 60_000, async () => ++jalan)).toBe(2);
  });

  it("tulisan SELAMA bacaan berjalan: jawaban bacaan itu tidak disimpan, dan pemanggil baru tidak ikut menunggunya", async () => {
    let jalan = 0;
    let lepas: () => void = () => undefined;
    const lambat = singgahSingkat("uji", "f", 60_000, async () => {
      jalan += 1;
      await new Promise<void>((r) => (lepas = r));
      return "sebelum-tulisan";
    });
    await tunda(1);
    tandaiTulisan(); // petugas menyimpan tunda di tengah bacaan
    const sesudah = singgahSingkat("uji", "f", 60_000, async () => {
      jalan += 1;
      return "sesudah-tulisan";
    });
    expect(await sesudah).toBe("sesudah-tulisan");
    lepas();
    expect(await lambat).toBe("sebelum-tulisan");
    expect(jalan).toBe(2);
    // Yang tersimpan adalah bacaan SESUDAH tulisan, bukan yang lama.
    expect(await singgahSingkat("uji", "f", 60_000, async () => "tidak-dipanggil")).toBe("sesudah-tulisan");
  });

  it("jawaban yang ditolak simpanBila (galat) tidak disimpan", async () => {
    let jalan = 0;
    const kerja = async () => ({ ok: false as const, n: ++jalan });
    await singgahSingkat("uji", "g", 60_000, kerja, { simpanBila: (h) => h.ok });
    await singgahSingkat("uji", "g", 60_000, kerja, { simpanBila: (h) => h.ok });
    expect(jalan).toBe(2);
  });

  it("tiap pemanggil mendapat SALINAN - mengubah jawaban tidak mencemari yang lain", async () => {
    const kerja = async () => ({ sidang: [{ nomor: "1" }] });
    const a = await singgahSingkat("uji", "h", 60_000, kerja);
    a.sidang.push({ nomor: "SISIPAN" });
    a.sidang[0].nomor = "DIUBAH";
    const b = await singgahSingkat("uji", "h", 60_000, kerja);
    expect(b.sidang).toEqual([{ nomor: "1" }]);
  });

  it("galat kerja diteruskan ke semua penunggu dan tidak tertinggal", async () => {
    const kerja = async () => {
      await tunda(5);
      throw new Error("bot mati");
    };
    const semua = await Promise.allSettled([1, 2].map(() => singgahSingkat("uji", "i", 60_000, kerja)));
    expect(semua.every((s) => s.status === "rejected")).toBe(true);
    expect(keadaanSinggah().berjalan).toBe(0);
  });
});

describe("permintaanMenulis - apa yang membatalkan singgahan", () => {
  it("GET/HEAD tidak; POST/DELETE ya; POST kesiapan (baca saja) tidak", () => {
    expect(permintaanMenulis("/internal/aleta-bot/sipp/jadwal-sidang?dari=x", undefined)).toBe(false);
    expect(permintaanMenulis("/internal/aleta-bot/sipp/jadwal-sidang", "GET")).toBe(false);
    expect(permintaanMenulis("/internal/aleta-bot/sidang/tunda", "POST")).toBe(true);
    expect(permintaanMenulis("/internal/aleta-bot/x", "delete")).toBe(true);
    expect(permintaanMenulis("/internal/aleta-bot/sipp/jadwal-sidang/kesiapan", "POST")).toBe(false);
  });
});

// ===========================================================================
// Lewat gerbang yang sesungguhnya - fetch dipalsukan, alamatnya dihitung.
// ===========================================================================
describe("jadwal sidang bersinggah + invalidasi oleh tulisan", () => {
  const alamat: Array<{ url: string; method: string }> = [];
  let nomorJawab = 0;

  beforeEach(() => {
    alamat.length = 0;
    nomorJawab = 0;
    process.env.ALETA_SINGGAH_JADWAL_MS = "4000";
    process.env.ALETA_SINGGAH_PEGAWAI_MS = "60000";
    process.env.ALETA_SINGGAH_TAG_MS = "30000";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        alamat.push({ url: String(url), method: String(init?.method || "GET") });
        nomorJawab += 1;
        await tunda(5);
        return new Response(
          JSON.stringify({ ok: true, dari: "", sampai: "", diperiksaPada: String(nomorJawab), sidang: [], hakim: [], tag: [], kelompok: [], dasar: [], jumlah: {}, lingkup: null }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ALETA_SINGGAH_JADWAL_MS;
    delete process.env.ALETA_SINGGAH_PEGAWAI_MS;
    delete process.env.ALETA_SINGGAH_TAG_MS;
  });

  const dasar = { dari: "2026-10-19", sampai: "2026-10-19", cari: "", batas: 200, waktu: true };
  const jadwalKeBot = () => alamat.filter((a) => a.url.includes("/sipp/jadwal-sidang?")).length;

  it("lima pemanggil serentak (tab, widget, layar publik) = satu permintaan ke bot", async () => {
    const hasil = await Promise.all([1, 2, 3, 4, 5].map(() => getGatewayJadwalSidangSinggah(dasar)));
    expect(jadwalKeBot()).toBe(1);
    expect(hasil.every((h) => h.ok)).toBe(true);
  });

  it("rentang/pilihan berbeda tidak berbagi jawaban", async () => {
    // K2 (25 Okt 2026): `waktu: false` kini MEMINJAM jawaban `waktu: true`
    // yang sudah ada (himpunan-atas) - dijaga singgah-jadwal-25okt.test.ts.
    // Yang tetap: rentang lain dan arah sebaliknya bertanya sendiri.
    await getGatewayJadwalSidangSinggah({ ...dasar, waktu: false });
    await getGatewayJadwalSidangSinggah(dasar);
    await getGatewayJadwalSidangSinggah({ ...dasar, sampai: "2026-10-20" });
    expect(jadwalKeBot()).toBe(3);
    expect(kunciSinggahJadwal(dasar)).not.toBe(kunciSinggahJadwal({ ...dasar, batas: 500 }));
  });

  it("TUNDA disimpan -> jadwal berikutnya dibaca ulang dari bot (tidak basi)", async () => {
    await getGatewayJadwalSidangSinggah(dasar);
    await getGatewayJadwalSidangSinggah(dasar);
    expect(jadwalKeBot()).toBe(1);
    await postGatewayTundaSidang({ nomorPerkara: "1/Pdt.G/2026/PA.Dgl" });
    const sesudah = await getGatewayJadwalSidangSinggah(dasar);
    expect(jadwalKeBot()).toBe(2);
    expect(sesudah.ok && sesudah.data.diperiksaPada).not.toBe("1");
  });

  it("tulisan lewat rute bot Jadwal Sidang (skors/selesai) juga membatalkan", async () => {
    await getGatewayJadwalSidangSinggah(dasar);
    await panggilBotJadwalSidang("/selesai", { method: "POST", body: { sidangId: "1" } });
    await getGatewayJadwalSidangSinggah(dasar);
    expect(jadwalKeBot()).toBe(2);
  });

  it("bacaan GET lewat rute bot Jadwal Sidang (disidang) TIDAK membatalkan", async () => {
    await getGatewayJadwalSidangSinggah(dasar);
    await panggilBotJadwalSidang("/disidang");
    await getGatewayJadwalSidangSinggah(dasar);
    expect(jadwalKeBot()).toBe(1);
  });

  it("POST kesiapan (baca saja) TIDAK membatalkan", async () => {
    await getGatewayJadwalSidangSinggah(dasar);
    await getGatewayKesiapanBanyak([], 50);
    await getGatewayJadwalSidangSinggah(dasar);
    expect(jadwalKeBot()).toBe(1);
  });

  it("gerbang mentah getGatewayJadwalSidang tetap tanpa singgahan", async () => {
    await getGatewayJadwalSidang(dasar);
    await getGatewayJadwalSidang(dasar);
    expect(jadwalKeBot()).toBe(2);
  });

  it("daftar hakim bersinggah; tulisan penunjukan/tak dikenal membuangnya", async () => {
    await gatewayPegawaiPenunjukan();
    await gatewayPegawaiPenunjukan();
    const keBot = () => alamat.filter((a) => a.url.includes("/penunjukan/pegawai")).length;
    expect(keBot()).toBe(1);
    // K2: tunda tidak menyentuh daftar hakim; jalur tulisan yang tidak dikenal
    // (penunjukan) membuang semuanya.
    await postGatewayTundaSidang({});
    await gatewayPegawaiPenunjukan();
    expect(keBot()).toBe(1);
    await getGatewayPenunjukanUsulan({} as never);
    await gatewayPegawaiPenunjukan();
    expect(keBot()).toBe(2);
  });

  it("hitungan tag bersinggah per lingkup; katalog saja tidak disinggahkan", async () => {
    const keBot = (s: string) => alamat.filter((a) => a.url.includes("/status-perkara/tag?") && a.url.includes(s)).length;
    await getGatewayTagPerkara({ periode: "total", acuan: "2026-10-19" });
    await getGatewayTagPerkara({ periode: "total", acuan: "2026-10-19" });
    expect(keBot("periode=total")).toBe(1);
    await getGatewayTagPerkara({ katalogSaja: "1" });
    await getGatewayTagPerkara({ katalogSaja: "1" });
    expect(keBot("katalogSaja=1")).toBe(2);
  });
});

// ===========================================================================
// Rekaman antrian: satu transaksi.
// ===========================================================================
describe("rekamAntrian - satu transaksi", () => {
  let db: AletaDatabase | null = null;
  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: false });
  });
  afterAll(async () => {
    await db?.close();
    db = null;
  });

  const baris = (id: string, ubah: Partial<BarisRekamAntrian> = {}): BarisRekamAntrian => ({
    id: `2026-10-19|${id}`,
    tanggalSidang: "2026-10-19",
    sidangId: id,
    perkaraId: `p${id}`,
    nomorPerkara: `${id}/Pdt.G/2026/PA.Dgl`,
    ruangan: "Ruang Sidang 1",
    nomorAntrian: 1,
    urutanRuang: 1,
    waktuAmbil: "08:00",
    jamPanggil: "",
    online: false,
    keadaan: "menunggu",
    namaPetugas: "",
    jarakSebelumMenit: null,
    jarakBerikutMenit: null,
    waktuAmbilLengkap: "",
    jamJadwal: "",
    waktuPanggilPertama: "",
    waktuPanggilLengkap: "",
    jumlahPanggil: 0,
    menungguDetik: null,
    jarakSebelumDetik: null,
    lamaSidangDetik: null,
    adaWaktu: false,
    bersumber: true,
    ...ubah,
  });

  it("banyak baris (urutan acak) tertulis seluruhnya dan terbaca kembali", async () => {
    const d = db as AletaDatabase;
    await d.run("DELETE FROM aleta_rekam_antrian");
    const hasil = await rekamAntrian(d, [baris("30"), baris("10"), baris("20")]);
    expect(hasil).toEqual({ ditulis: 3, gagal: "" });
    const terbaca = await bacaRekamAntrian(d, "2026-10-19", "2026-10-19");
    expect(terbaca.map((b) => b.sidangId).sort()).toEqual(["10", "20", "30"]);
  });

  it("menulis ulang baris yang sama tetap satu baris (ON CONFLICT), nilainya yang terbaru", async () => {
    const d = db as AletaDatabase;
    await d.run("DELETE FROM aleta_rekam_antrian");
    await rekamAntrian(d, [baris("10")]);
    await rekamAntrian(d, [baris("10", { nomorAntrian: 7 })]);
    const terbaca = await bacaRekamAntrian(d, "2026-10-19", "2026-10-19");
    expect(terbaca).toHaveLength(1);
    expect(terbaca[0].nomorAntrian).toBe(7);
  });

  it("memakai withTransaction (satu commit) dan mengunci baris dalam urutan id", () => {
    const sumber = readFileSync(path.resolve(__dirname, "../server/modules/aleta-ecourt/rekam-antrian.ts"), "utf8");
    const i = sumber.indexOf("export async function rekamAntrian(");
    const badan = sumber.slice(i, sumber.indexOf("\n}\n", i));
    expect(badan).toContain("await withTransaction(db, async (tx) =>");
    expect(badan).toContain("await tx.run(");
    expect(badan).not.toContain("await db.run(");
    expect(badan).toContain(".sort(");
  });
});

// ===========================================================================
// Bot: jadwal dan peta antrian dibaca bersamaan.
// ===========================================================================
describe("rute bot /sipp/jadwal-sidang - bacaan bersamaan", () => {
  const sumber = readFileSync(path.resolve(__dirname, "../../../aleta_bot/routes/internalGatewayRoutes.js"), "utf8");
  const i = sumber.indexOf('router.get("/sipp/jadwal-sidang", requireInternalToken');
  const badan = sumber.slice(i, sumber.indexOf("\n});", i));

  it("daftarSidang dan petaAntrian dalam satu Promise.all", () => {
    const iAll = badan.indexOf("await Promise.all([");
    expect(iAll).toBeGreaterThan(-1);
    expect(badan.indexOf("sippJadwalSidangService.daftarSidang(")).toBeGreaterThan(iAll);
    expect(badan.indexOf("antrianSidangService.petaAntrian()")).toBeGreaterThan(iAll);
    expect(badan).not.toContain("const petaPenuh = await");
  });

  it("kehadiran per tanggal bersamaan (allSettled) dan waktu antrian tidak menunggu kehadiran", () => {
    expect(badan).toContain("Promise.allSettled(");
    expect(badan.indexOf("const janjiWaktuAntrian = antrianWaktuService")).toBeLessThan(badan.indexOf("Promise.allSettled("));
    expect(badan).toContain("const waktuAntrian = await janjiWaktuAntrian;");
  });
});
