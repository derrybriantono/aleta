// @vitest-environment node
/**
 * ============================================================================
 * JADWAL DARI CERMIN SAAT SIPP TIDAK TERJANGKAU (5 Nov 2026)
 * ============================================================================
 *
 *   A. kapan galat boleh diganti cermin (sippTakTerjangkau) dan kalimat untuk petugas;
 *   B. Jadwal Sidang: bot gagal -> salinan terakhir dari aleta_cermin_sidang + penanda; hanya bila
 *      diminta layar, tanpa pencarian, pemindaian awal selesai; jawaban normal TIDAK berubah; tidak disinggahkan;
 *   C. Jadwal Mediasi: idem, hanya untuk rentang di jendela yang terakhir berhasil dihitung;
 *   D. rute: jawaban memuat dariCermin/waktuSinkron/keterangan, layar menampilkan satu baris biasa;
 *   E. modul tidak menulis ke SIPP dan tidak memanggil bot (hanya SELECT ke tabel aleta_cermin_*).
 *
 * Data rekaan saja. Tidak ada jaringan dan tidak ada SIPP sungguhan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PENGATURAN_CERMIN_BAWAAN, keadaanMediasiAwal, keadaanPemindaiAwal } from "@/lib/cermin";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { getGatewayJadwalSidangSinggah } from "@/server/modules/aleta-bot/jadwal-sidang-singgah";
import type { SidangSumber } from "@/server/modules/cermin/bot";
import { jadwalSidangDariCerminDarurat, keteranganTakTerjangkau, mediasiDariCerminDarurat, sippTakTerjangkau } from "@/server/modules/cermin/darurat";
import { KUNCI_JEJAK, tulisJejak } from "@/server/modules/cermin/jejak";
import { aturUlangPembaruanCermin } from "@/server/modules/cermin/pembaruan";
import { buangSinggahPengaturanCermin } from "@/server/modules/cermin/pengaturan";
import { simpanJendelaSidang } from "@/server/modules/cermin/penyimpan";
import { aturTulisCerminTerakhir } from "@/server/modules/cermin/setelah-tulisan";
import { tandaiTulisan } from "@/server/shared/singgah-singkat";

const AKAR = path.resolve(__dirname, "../../..");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");

let dbRute: AletaDatabase | null = null;
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr-super" }));
vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => dbRute };
});

const HARI = "2026-11-05";
// 01.12 UTC = 09.12 WITA
const SINKRON = "2026-11-05T01:12:00.000Z";
const SEKARANG = new Date("2026-11-05T03:00:00.000Z"); // 11.00 WITA

let db: AletaDatabase;
let panggilanBot: string[] = [];
type ModeBot = "mati" | "http500" | "http400" | "hidup";
let modeBot: ModeBot = "mati";

const REKAAN: Array<Record<string, unknown> & { sidangId: string; perkaraId: string; tanggalSidang: string; jamSidang: string }> = [
  { sidangId: "2", perkaraId: "102", nomorPerkara: "186/Pdt.G/2026/PA.Rekaan", tanggalSidang: HARI, jamSidang: "09:00:00", alurPerkaraId: 15, agenda: "Pembuktian", ruangan: "Ruang 1" },
  { sidangId: "1", perkaraId: "101", nomorPerkara: "1000/Pdt.G/2026/PA.Rekaan", tanggalSidang: HARI, jamSidang: "09:00:00", alurPerkaraId: 15, agenda: "Jawaban", ruangan: "Ruang 1" },
  { sidangId: "3", perkaraId: "103", nomorPerkara: "7/Pdt.G/2026/PA.Rekaan", tanggalSidang: "2026-10-01", jamSidang: "10:00:00", alurPerkaraId: 16, agenda: "Putusan", ruangan: "Ruang 2" },
];

async function pemindaiSelesai(selesai = true) {
  const k = keadaanPemindaiAwal();
  if (selesai) {
    k.status = "selesai";
    k.tahap = "selesai";
    k.selesaiPada = "2026-10-30T10:00:00.000Z";
  }
  await tulisJejak(db, KUNCI_JEJAK.pemindai, k);
}
async function pembaruan(terakhirPada = SINKRON) {
  await tulisJejak(db, KUNCI_JEJAK.pembaruan, {
    tanda: "",
    putaranTerakhir: "2026-11-05T02:59:00.000Z", // putaran GAGAL pun memajukan ini; waktu sinkron = terakhir.pada
    panasTerakhir: "2026-11-05T00:00:00.000Z",
    antrianTanggal: [],
    terakhir: terakhirPada ? { perkara: 0, tanggal: 1, ditulis: 0, ms: 5, pada: terakhirPada } : null,
    galat: { terakhir: "bot mati", pada: "", beruntun: 4 },
    tidakTerbaca: [],
  });
}
async function isiSidang() {
  const sidang: SidangSumber[] = REKAAN.map((b) => ({
    sidangId: b.sidangId,
    perkaraId: b.perkaraId,
    tanggalSidang: b.tanggalSidang,
    jamSidang: b.jamSidang,
    ruangan: String(b.ruangan),
    agenda: String(b.agenda),
    ditunda: 0,
    sippDiperbarui: "2026-11-05 08:00:00",
    baris: b,
  }));
  await simpanJendelaSidang(db, { sidang }, SINKRON);
}

function pasangBot(mode: ModeBot) {
  modeBot = mode;
  panggilanBot = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (masuk: string) => {
      const url = new URL(String(masuk));
      panggilanBot.push(url.pathname);
      if (modeBot === "mati") throw new TypeError("fetch failed");
      const json = (isi: unknown, status = 200) => new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
      if (modeBot === "http500") return json({ ok: false, error: "SIPP tidak terbaca" }, 500);
      if (modeBot === "http400") return json({ ok: false, error: "rentang tidak sah" }, 400);
      if (url.pathname.endsWith("/sipp/jadwal-mediasi")) return json({ ok: true, dari: HARI, sampai: HARI, terbaca: true, alasan: "", mediasi: [] });
      return json({ ok: true, dari: HARI, sampai: HARI, diperiksaPada: "dari-sipp", sidang: [{ sidangId: "99", tanggalSidang: HARI }], antrian: { terbaca: true, alasan: "", tanggal: [HARI], peta: {} } });
    })
  );
}

beforeEach(async () => {
  dbRute = db = await createAletaDatabase({ useInMemory: true, seed: true });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(SEKARANG);
  process.env.ALETA_CERMIN_JADWAL_UJI = "1";
  process.env.ALETA_SINGGAH_JADWAL_MS = "0";
  aturUlangPembaruanCermin();
  aturTulisCerminTerakhir(0);
  buangSinggahPengaturanCermin();
  tandaiTulisan();
});
afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.ALETA_CERMIN_JADWAL_UJI;
  delete process.env.ALETA_SINGGAH_JADWAL_MS;
  await db.close();
  dbRute = null;
});

// ============================================================================
describe("A. kapan galat boleh diganti cermin, dan kalimat untuk petugas", () => {
  it("tak terjangkau: tanpa status, 5xx, 408, 429, atau bot menjawab gagal (2xx); ditolak 4xx: tidak", () => {
    expect(sippTakTerjangkau({ ok: false })).toBe(true);
    expect(sippTakTerjangkau({ ok: false, status: 500 })).toBe(true);
    expect(sippTakTerjangkau({ ok: false, status: 503 })).toBe(true);
    expect(sippTakTerjangkau({ ok: false, status: 408 })).toBe(true);
    expect(sippTakTerjangkau({ ok: false, status: 429 })).toBe(true);
    expect(sippTakTerjangkau({ ok: false, status: 200 })).toBe(true);
    expect(sippTakTerjangkau({ ok: false, status: 400 })).toBe(false);
    expect(sippTakTerjangkau({ ok: false, status: 401 })).toBe(false);
    expect(sippTakTerjangkau({ ok: false, status: 404 })).toBe(false);
    expect(sippTakTerjangkau({ ok: true })).toBe(false);
  });

  it("kalimat: jam WITA hari ini; hari lain disertai tanggal; tanpa istilah teknis", () => {
    expect(keteranganTakTerjangkau(SINKRON, SEKARANG)).toBe("Data terakhir 09.12, SIPP sedang tidak terjangkau.");
    expect(keteranganTakTerjangkau("2026-11-03T13:40:00.000Z", SEKARANG)).toBe("Data terakhir 03/11 21.40, SIPP sedang tidak terjangkau.");
    expect(keteranganTakTerjangkau(SINKRON, SEKARANG)).not.toMatch(/cermin|bot|database|basis data/i);
  });
});

// ============================================================================
describe("B. Jadwal Sidang: bot gagal -> salinan terakhir dengan penanda", () => {
  const p = { dari: HARI, sampai: HARI, cari: "", batas: 200, waktu: true, daruratCermin: true };

  async function siap() {
    await pemindaiSelesai();
    await pembaruan();
    await isiSidang();
  }

  it("bot mati: daftar dari aleta_cermin_sidang, urut seperti jalur lama, dengan dariCermin, waktu sinkron, dan antrian tak terbaca", async () => {
    await siap();
    pasangBot("mati");
    const h = await getGatewayJadwalSidangSinggah({ ...p, dari: "2026-10-01", sampai: HARI });
    expect(h.ok).toBe(true);
    const d = (h as { data: Record<string, any> }).data;
    expect(d.dariCermin).toBe(true);
    expect(d.waktuSinkron).toBe(SINKRON);
    expect(d.keterangan).toBe("Data terakhir 09.12, SIPP sedang tidak terjangkau.");
    // Tanpa objek `cermin`: tanda "Cermin · diperbarui" tidak ikut tampil di samping kalimat keterangan.
    expect(d.cermin).toBeUndefined();
    // tanggal, jam, alur, nomor sebagai ANGKA: 1 Okt dulu, lalu 186 sebelum 1000.
    expect(d.sidang.map((b: { sidangId: string }) => b.sidangId)).toEqual(["3", "2", "1"]);
    expect(d.antrian).toMatchObject({ terbaca: false, peta: {} });
  });

  it("SIPP menjawab 500 atau bot menjawab gagal: sama; ditolak 400: galat asli, tanpa cermin", async () => {
    await siap();
    pasangBot("http500");
    expect((await getGatewayJadwalSidangSinggah(p)) as { ok: boolean; data?: { dariCermin?: boolean } }).toMatchObject({ ok: true, data: { dariCermin: true } });
    pasangBot("http400");
    expect(await getGatewayJadwalSidangSinggah(p)).toMatchObject({ ok: false, status: 400 });
  });

  it("layar yang tidak meminta (layar publik) tetap mendapat galat; jawaban normal TIDAK berubah dan tanpa penanda", async () => {
    await siap();
    pasangBot("mati");
    expect(await getGatewayJadwalSidangSinggah({ ...p, daruratCermin: undefined })).toMatchObject({ ok: false });
    pasangBot("hidup");
    const h = (await getGatewayJadwalSidangSinggah(p)) as { ok: boolean; data: Record<string, any> };
    expect(h.ok).toBe(true);
    expect(h.data.dariCermin).toBeUndefined();
    expect(h.data.sidang).toEqual([{ sidangId: "99", tanggalSidang: HARI }]); // dari SIPP, bukan cermin
    expect(panggilanBot.some((x) => x.endsWith("/sipp/jadwal-sidang"))).toBe(true);
  });

  it("tanpa pemindaian selesai, tanpa waktu sinkron, atau dengan pencarian: galat asli", async () => {
    pasangBot("mati");
    await pemindaiSelesai(false);
    await pembaruan();
    await isiSidang();
    expect(await getGatewayJadwalSidangSinggah(p)).toMatchObject({ ok: false });
    await pemindaiSelesai(true);
    await tulisJejak(db, KUNCI_JEJAK.pembaruan, { tanda: "", putaranTerakhir: "", panasTerakhir: "", antrianTanggal: [], terakhir: null, galat: { terakhir: "", pada: "", beruntun: 0 }, tidakTerbaca: [] });
    await tulisJejak(db, KUNCI_JEJAK.pemindai, { ...keadaanPemindaiAwal(), status: "selesai", tahap: "selesai", selesaiPada: "" });
    expect(await getGatewayJadwalSidangSinggah(p)).toMatchObject({ ok: false });
    await siap();
    expect(await getGatewayJadwalSidangSinggah({ ...p, cari: "Dirman" })).toMatchObject({ ok: false });
  });

  it("jawaban dari salinan TIDAK disinggahkan: begitu bot pulih, permintaan berikutnya dari SIPP", async () => {
    process.env.ALETA_SINGGAH_JADWAL_MS = "4000";
    await siap();
    pasangBot("mati");
    const a = (await getGatewayJadwalSidangSinggah(p)) as { data: Record<string, any> };
    expect(a.data.dariCermin).toBe(true);
    pasangBot("hidup");
    const b = (await getGatewayJadwalSidangSinggah(p)) as { data: Record<string, any> };
    expect(b.data.dariCermin).toBeUndefined();
    expect(b.data.diperiksaPada).toBe("dari-sipp");
  });

  it("fungsi inti: tidak melempar saat basis data rusak, dan batas dihormati", async () => {
    await siap();
    const rusak = { queryAll: async () => { throw new Error("db mati"); } } as unknown as AletaDatabase;
    expect(await jadwalSidangDariCerminDarurat(p, { db: async () => rusak, sekarang: () => SEKARANG })).toBeNull();
    const satu = await jadwalSidangDariCerminDarurat({ ...p, dari: "2026-10-01", sampai: HARI, batas: 1 }, { db: async () => db, sekarang: () => SEKARANG });
    expect(satu?.data.sidang).toHaveLength(1);
  });
});

// ============================================================================
describe("C. Jadwal Mediasi: hanya untuk jendela yang terakhir berhasil dihitung", () => {
  async function isiMediasi() {
    const baris = (id: string, tanggal: string, lebih: Record<string, unknown> = {}) => ({ mediasiId: id, perkaraId: `3${id}`, nomorPerkara: `${id}/Pdt.G/2026/PA.Rekaan`, tanggal, jam: "09:00", tenggatPerma: "2026-11-10", ...lebih });
    const data = [baris("1", HARI), baris("2", "2026-11-03", { tenggatPerma: "2026-11-01" })];
    for (const m of data) {
      await db.run(
        "INSERT INTO aleta_cermin_mediasi (id, perkara_id, tanggal, mediator, status, baris_json, sipp_diperbarui, cermin_diperbarui, sidik) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [`${m.mediasiId}|${m.tanggal}|09:00`, m.perkaraId, m.tanggal, "", "", JSON.stringify(m), "", SINKRON, "x"]
      );
    }
    await tulisJejak(db, KUNCI_JEJAK.mediasi, { ...keadaanMediasiAwal(), terakhir: SINKRON, dari: "2026-11-02", sampai: "2026-11-26" });
  }

  it("rentang di dalam jendela: baris cermin, sisa tenggang dihitung terhadap HARI INI, dengan penanda", async () => {
    await pemindaiSelesai();
    await isiMediasi();
    const h = await mediasiDariCerminDarurat({ dari: "2026-11-02", sampai: "2026-11-10" }, { db: async () => db, sekarang: () => SEKARANG });
    expect(h).not.toBeNull();
    expect(h!.data).toMatchObject({ dariCermin: true, waktuSinkron: SINKRON, keterangan: "Data terakhir 09.12, SIPP sedang tidak terjangkau.", terbaca: true });
    expect(h!.data.mediasi.map((m) => m.mediasiId)).toEqual(["2", "1"]);
    expect(h!.data.mediasi[0]).toMatchObject({ sisaHariTenggat: -4, lewatTenggang: true });
    expect(h!.data.mediasi[1]).toMatchObject({ sisaHariTenggat: 5, lewatTenggang: false });
  });

  it("di luar jendela, tanpa hitungan berhasil, pemindaian belum selesai, atau pencarian: tidak dijawab", async () => {
    await pemindaiSelesai();
    await isiMediasi();
    const deps = { db: async () => db, sekarang: () => SEKARANG };
    expect(await mediasiDariCerminDarurat({ dari: "2026-09-01", sampai: "2026-09-30" }, deps)).toBeNull();
    expect(await mediasiDariCerminDarurat({ dari: "2026-11-02", sampai: "2026-12-30" }, deps)).toBeNull();
    expect(await mediasiDariCerminDarurat({ dari: HARI, sampai: HARI, cari: "Dirman" }, deps)).toBeNull();
    await pemindaiSelesai(false);
    expect(await mediasiDariCerminDarurat({ dari: HARI, sampai: HARI }, deps)).toBeNull();
    await pemindaiSelesai(true);
    await tulisJejak(db, KUNCI_JEJAK.mediasi, keadaanMediasiAwal());
    expect(await mediasiDariCerminDarurat({ dari: HARI, sampai: HARI }, deps)).toBeNull();
  });
});

// ============================================================================
describe("D. rute dan layar", () => {
  it("rute Jadwal Mediasi: bot mati -> available true dengan dariCermin, waktuSinkron, keterangan", async () => {
    await pemindaiSelesai();
    await tulisJejak(db, KUNCI_JEJAK.mediasi, { ...keadaanMediasiAwal(), terakhir: SINKRON, dari: "2026-11-02", sampai: "2026-11-26" });
    pasangBot("mati");
    const modul = await import("@/app/api/aleta-ecourt/jadwal-mediasi/route");
    const jawaban = await modul.GET(new NextRequest(`http://localhost/api/aleta-ecourt/jadwal-mediasi?dari=${HARI}&sampai=${HARI}`));
    const isi = (await jawaban.json()) as { data: Record<string, any> };
    expect(jawaban.status).toBe(200);
    expect(isi.data).toMatchObject({ available: true, dariCermin: true, waktuSinkron: SINKRON, keterangan: "Data terakhir 09.12, SIPP sedang tidak terjangkau.", mediasi: [] });
  });

  it("rute Jadwal Mediasi: bot hidup -> jawaban biasa tanpa penanda", async () => {
    await pemindaiSelesai();
    pasangBot("hidup");
    const modul = await import("@/app/api/aleta-ecourt/jadwal-mediasi/route");
    const jawaban = await modul.GET(new NextRequest(`http://localhost/api/aleta-ecourt/jadwal-mediasi?dari=${HARI}&sampai=${HARI}`));
    const isi = (await jawaban.json()) as { data: Record<string, any> };
    expect(isi.data).toMatchObject({ available: true, dariCermin: false, keterangan: "" });
  });

  it("rute Jadwal Mediasi: tanpa salinan yang layak -> galat asli (available false)", async () => {
    pasangBot("mati");
    const modul = await import("@/app/api/aleta-ecourt/jadwal-mediasi/route");
    const jawaban = await modul.GET(new NextRequest(`http://localhost/api/aleta-ecourt/jadwal-mediasi?dari=${HARI}&sampai=${HARI}`));
    const isi = (await jawaban.json()) as { data: Record<string, any> };
    expect(isi.data.available).toBe(false);
  });

  it("rute Jadwal Sidang meminta salinan darurat dan meneruskan penandanya; layar menampilkan satu baris biasa", () => {
    const rute = baca("manajemen_surat/src/app/api/aleta-ecourt/sidang/route.ts");
    expect(rute).toContain("daruratCermin: true");
    expect(rute).toContain("dariCermin:");
    expect(rute).toContain("keterangan:");
    const sidang = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
    expect(sidang).toContain('data-testid="tanda-sipp-tidak-terjangkau"');
    expect(sidang).toContain("setKeteranganSipp(String(data.keterangan");
    const mediasi = baca("manajemen_surat/src/components/portal/aleta-ecourt-mediasi.tsx");
    expect(mediasi).toContain('data-testid="tanda-sipp-tidak-terjangkau"');
    expect(mediasi).toContain("setKeteranganSipp(String(data?.keterangan");
  });
});

// ============================================================================
describe("E. tidak ada tulisan ke SIPP dan tidak ada panggilan baru ke bot", () => {
  const sumber = baca("manajemen_surat/src/server/modules/cermin/darurat.ts");
  const kode = sumber.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("modul darurat hanya membaca basis data ALETA: tanpa fetch, tanpa gateway bot, tanpa INSERT/UPDATE/DELETE", () => {
    expect(kode).not.toMatch(/\bfetch\s*\(/);
    expect(kode).not.toMatch(/gateway|panggilBot|botCermin/i);
    expect(kode).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/);
    expect(kode).not.toMatch(/\.(run|exec)\(/);
  });

  it("bot tidak disentuh: tidak ada berkas bot yang berubah untuk fitur ini dan tak satu kata 'Aleta' ditulis ke SIPP", () => {
    // Fitur ini murni portal; layanan bot jadwal tetap hanya membaca.
    const botJadwal = baca("aleta_bot/services/sippJadwalSidangService.js");
    expect(botJadwal).not.toMatch(/\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b[^;\n]*perkara_jadwal_sidang/i);
    expect(sumber).not.toMatch(/aleta_bot/);
  });
});
