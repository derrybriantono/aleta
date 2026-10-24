// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { newDb } from "pg-mem";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { hitungHarga, PARAMETER_HARGA_BAWAAN, type PenggunaanToken } from "@/lib/aleta-ai/biaya";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_ALETA_AI_DOMPET } from "@/server/db/schema";
import type { PelakuAi } from "@/server/modules/aleta-ai/akses";
import { PESAN_BATAS_HARIAN, PESAN_BATAS_SATKER } from "@/server/modules/aleta-ai/batas";
import { strukGiliran, strukMutasi, tampilDompet } from "@/server/modules/aleta-ai/dompet";
import { GalatKlienAi, suntikKlienAi, type HasilAi, type KlienAi, type OpsiAlir } from "@/server/modules/aleta-ai/klien";
import { pastikanKuotaBulanIni, simpanKuotaPeran, tanggalHangus } from "@/server/modules/aleta-ai/kuota";
import { angkaKurs, bacaJisdorBi, buatPengambilKurs, kursBerlaku, segarkanKursBilaPerlu, simpanKurs, tanggalLokal, type PengambilHttp } from "@/server/modules/aleta-ai/kurs";
import { laporanBulanan, laporanKeCsv, laporanKeXlsx, laporanRentang } from "@/server/modules/aleta-ai/laporan";
import { izinkanLaju, kirimPesan, PESAN_NONAKTIF_SAKLAR, perkirakanPesan, ulangiBatasLaju, type EventAi } from "@/server/modules/aleta-ai/mesin";
import { buatPercakapan } from "@/server/modules/aleta-ai/percakapan";
import { bacaPengaturan, simpanPengaturan, type PerubahanPengaturan } from "@/server/modules/aleta-ai/pengaturan";
import { perkirakanBiayaTugas } from "@/server/modules/aleta-ai/perkiraan";
import { unggahProyek } from "@/server/modules/aleta-ai/proyek";
import { jalankanRekonsiliasi } from "@/server/modules/aleta-ai/rekonsiliasi";
import { ALASAN_SAKLAR, aletaAiDihentikan, daftarkanPekerjaanAi, jumlahPekerjaanAiBerjalan, pantauSaklar } from "@/server/modules/aleta-ai/saklar";
import { daftarMutasi, koreksiSaldo, saldoPengguna, selesaikanTahanan, tahanDana, terapkanMutasi, verifikasiSaldo } from "@/server/modules/aleta-ai/saldo";
import { susunZip } from "@/server/shared/zip";

/**
 * ============================================================================
 * ALETA Ai TAHAP 4 - DOMPET LENGKAP (T10, 25 Okt 2026)
 * ============================================================================
 *
 * Tanpa jaringan dan tanpa kunci API: klien Claude TIRUAN dan HTTP kurs TIRUAN.
 * Fixture proyek rekaan kecil. Perilaku nyata (pg-mem + rute HTTP), bukan teks kode.
 *
 *   1. migrasi 0088 = DDL schema.ts, jurnal idx 76, ikut cadangan
 *   2. rumus harga dengan angka contoh (kurs + penyangga, margin, MDR, pembulatan, minimum)
 *   3. kurs: JISDOR BI lewat HTTP tiruan, cadangan sumber terbuka, kurs terakhir, dicatat per giliran
 *   4. tahan/lepas/potong idempoten di bawah pemanggilan ganda
 *   5. perkiraan sebelum jalan; gagal = tidak dipotong; selisih kembali
 *   6. batas harian (token & rupiah), batas satker per bulan, batas laju
 *   7. saklar darurat (giliran berjalan & tugas T9)
 *   8. kuota hibah per peran (mutasi "kuota", sekali per bulan)
 *   9. laporan laba = jumlah mutasi; ekspor CSV/XLSX; rekonsiliasi menandai selisih
 *  10. dompet & struk; hak per peran di rute
 */

const ctx = vi.hoisted(() => ({ db: null as unknown, aktor: null as string | null }));

vi.mock("@/server/db/client", async (asli) => ({
  ...(await asli<typeof import("@/server/db/client")>()),
  getDatabase: async () => ctx.db,
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => ctx.aktor }));

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

const hakim = (id: string): PelakuAi => ({ id, nama: `Hakim ${id}`, peranId: "hakim", superAdmin: false });
const superAdmin: PelakuAi = { id: "u-sa", nama: "Super Rekaan", peranId: "super-admin", superAdmin: true };

// ─── Fixture proyek & klien tiruan ───────────────────────────────────────────

const MENU_MD = `# ALETA_05 — TRIGGER MENU LENGKAP
## KELOMPOK A — DRAFTING UTAMA
| Trigger | Output |
|---|---|
| Duduk Perkara | Ringkasan rekaan |

## KELOMPOK I — UTILITAS
| Trigger | Output |
|---|---|
| help / bantuan / ? | Menu ini |
`;

const zipRekaan = () =>
  susunZip(
    [
      { nama: "ALETA_AI_PA_Edition_V4_5_Core_Prompt.md", isi: "# CORE PROMPT REKAAN\nAsisten rekaan untuk uji. " + "Kalimat pengisi. ".repeat(30) },
      { nama: "ALETA_05_Trigger_Menu.md", isi: MENU_MD },
      { nama: "ALETA_08_Format_Putusan_Donggala.md", isi: "# ALETA_08 — FORMAT PUTUSAN\nIsi rekaan." },
    ].map((e) => ({ nama: e.nama, isi: Buffer.from(e.isi, "utf8") }))
  );

type Jawaban = { teks?: string[]; penggunaan?: Partial<PenggunaanToken>; galat?: GalatKlienAi; sesudahTeksPertama?: () => Promise<void> };
const NOL: PenggunaanToken = { masuk: 0, keluar: 0, cacheTulis: 0, cacheBaca: 0 };

class KlienTiruan implements KlienAi {
  jawaban = 0;
  hitungan = 0;
  constructor(private antrean: Jawaban[] = []) {}

  async alirkan(p: import("@/lib/aleta-ai/penyusun").PermintaanAi, opsi: OpsiAlir = {}): Promise<HasilAi> {
    this.jawaban += 1;
    const j = this.antrean.shift() ?? { teks: ["Jawaban rekaan."], penggunaan: { masuk: 1000, keluar: 500 } };
    if (j.galat) throw j.galat;
    let teks = "";
    let n = 0;
    for (const potong of j.teks ?? []) {
      if (opsi.sinyal?.aborted) throw new GalatKlienAi("dibatalkan", "Permintaan dibatalkan.");
      await Promise.resolve();
      teks += potong;
      opsi.onTeks?.(potong);
      n += 1;
      if (n === 1 && j.sesudahTeksPertama) await j.sesudahTeksPertama();
    }
    if (opsi.sinyal?.aborted) throw new GalatKlienAi("dibatalkan", "Permintaan dibatalkan.");
    return { teks, berhenti: "selesai", model: p.model, penggunaan: { ...NOL, ...(j.penggunaan ?? {}) }, iterasi: [], kategoriTolak: "", dialihkan: false };
  }

  async hitungToken(): Promise<number> {
    this.hitungan += 1;
    return 4000;
  }
}

async function kumpulkan(g: AsyncGenerator<EventAi, void, void>): Promise<EventAi[]> {
  const hasil: EventAi[] = [];
  for await (const e of g) hasil.push(e);
  return hasil;
}

const TEKS_DP = "Duduk Perkara dari gugatan rekaan nomor 1/Pdt.G/2026";

async function dbBaru(): Promise<AletaDatabase> {
  const db = await createAletaDatabase({ useInMemory: true, seed: false });
  await simpanKurs(db, { tanggal: tanggalLokal(), kurs: 16000, sumber: "uji" });
  await unggahProyek(db, superAdmin.id, { bita: zipRekaan(), namaBerkas: "proyek-rekaan.zip" });
  return db;
}

const isi = (db: AletaDatabase, id: string, rp: number) => terapkanMutasi(db, { penggunaId: id, jenis: "isi", jumlahRp: rp, catatan: "uji" });
const jenisMutasi = async (db: AletaDatabase, id: string) => (await daftarMutasi(db, id, 200)).map((m) => `${m.jenis}:${m.jumlahRp}`).reverse();

// ─── 1. Migrasi ──────────────────────────────────────────────────────────────

describe("migrasi 0088 - berkas = DDL schema.ts, jurnal idx 76, ikut cadangan", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0088_aleta_ai_dompet.sql");

  it("jurnal: 0088 sekali di idx 76 (sesudah 0083), tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0088_"))).toEqual([expect.objectContaining({ idx: 76, tag: "0088_aleta_ai_dompet" })]);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i]?.when).toBeGreaterThan(j.entries[i - 1]?.when ?? 0);
    expect(existsSync(SQL)).toBe(true);
  });

  it("pernyataan berkas = DDL_ALETA_AI_DOMPET dan berjalan di atas tabel 0078 (pg-mem); tabel baru ikut cadangan", () => {
    const isiSql = readFileSync(SQL, "utf8");
    expect(pernyataan(isiSql)).toEqual([...DDL_ALETA_AI_DOMPET.tabel, ...DDL_ALETA_AI_DOMPET.indeks, ...DDL_ALETA_AI_DOMPET.kolom].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(readFileSync(path.join(process.cwd(), "drizzle", "0078_aleta_ai.sql"), "utf8"));
    kosong.public.none(isiSql);
    expect(kosong.public.many(`SELECT * FROM aleta_ai_kuota_peran`)).toEqual([]);
    expect(kosong.public.many(`SELECT * FROM aleta_ai_rekonsiliasi`)).toEqual([]);
    kosong.public.none(`INSERT INTO aleta_ai_obrolan_pesan (id, percakapan_id, pemilik_id, peran, dibuat_at) VALUES ('p', 'c', 'u', 'ai', 'x')`);
    expect(kosong.public.one(`SELECT biaya_mdr_rp, kurs_tanggal, kurs_sumber FROM aleta_ai_obrolan_pesan`)).toEqual({ biaya_mdr_rp: 0, kurs_tanggal: "", kurs_sumber: "" });
    for (const t of ["aleta_ai_kuota_peran", "aleta_ai_rekonsiliasi"]) expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
  });
});

// ─── 2. Rumus harga ──────────────────────────────────────────────────────────

describe("rumus harga = biaya API x kurs x (1 + margin) + MDR, ke atas Rp500, minimum Rp1.000", () => {
  const polos = { marginPersen: 0, penyanggaKursPersen: 0, minimumRp: 1000, pembulatanRp: 500, mdrPersen: 0 };

  it("bawaan: margin 30%, penyangga kurs 3%, MDR 1%, minimum Rp1.000, pembulatan Rp500", () => {
    expect(PARAMETER_HARGA_BAWAAN).toEqual({ marginPersen: 30, penyanggaKursPersen: 3, minimumRp: 1000, pembulatanRp: 500, mdrPersen: 1 });
  });

  it("contoh lengkap: $0,118 pada kurs 16.000 -> kurs 16.480; pokok Rp2.528,03 + MDR 1% Rp25,28 = Rp2.553,31 -> Rp3.000", () => {
    const h = hitungHarga(0.118, 16000, PARAMETER_HARGA_BAWAAN);
    expect(h.kursDasar).toBe(16000);
    expect(h.kurs).toBeCloseTo(16480, 6);
    expect(h.biayaApiRp).toBeCloseTo(1888, 6); // biaya API pada kurs dasar (untuk laba)
    expect(h.biayaMdrRp).toBeCloseTo(25.28032, 6);
    expect(h.hargaRp).toBe(3000);
    expect(h.tagihRp).toBe(3000);
  });

  it("MDR dapat menaikkan satu kelipatan: tepat Rp1.500 tanpa MDR, Rp1.515 dengan MDR 1% -> Rp2.000; pokok Rp1.300 + MDR Rp13 -> Rp1.500", () => {
    expect(hitungHarga(0.15, 10000, polos).tagihRp).toBe(1500);
    expect(hitungHarga(0.15, 10000, { ...polos, mdrPersen: 1 })).toMatchObject({ tagihRp: 2000, biayaMdrRp: 15 });
    expect(hitungHarga(0.1, 10000, { ...polos, marginPersen: 30, mdrPersen: 1 })).toMatchObject({ tagihRp: 1500, biayaMdrRp: 13 });
  });

  it("margin dan penyangga kurs: $0,1 x 10.000 -> Rp1.300 (margin 30%) dan Rp1.030 (penyangga 3%), keduanya -> Rp1.500", () => {
    expect(hitungHarga(0.1, 10000, { ...polos, marginPersen: 30 }).tagihRp).toBe(1500);
    expect(hitungHarga(0.1, 10000, { ...polos, penyanggaKursPersen: 3 })).toMatchObject({ kurs: 10300, tagihRp: 1500 });
    // Kelipatan lain diatur Super Admin: Rp1.300 dibulatkan ke atas Rp1.000 -> Rp2.000.
    expect(hitungHarga(0.1, 10000, { ...polos, marginPersen: 30, pembulatanRp: 1000 }).tagihRp).toBe(2000);
  });

  it("minimum Rp1.000; nol token = Rp0; Super Admin gratis (tagih 0, MDR 0) tetapi harga asli tetap dihitung", () => {
    expect(hitungHarga(0.0001, 16000, PARAMETER_HARGA_BAWAAN).tagihRp).toBe(1000);
    expect(hitungHarga(0, 16000, PARAMETER_HARGA_BAWAAN)).toMatchObject({ hargaRp: 0, tagihRp: 0, biayaMdrRp: 0 });
    expect(hitungHarga(0.118, 16000, PARAMETER_HARGA_BAWAAN, { gratis: true })).toMatchObject({ hargaRp: 3000, tagihRp: 0, biayaMdrRp: 0 });
  });
});

// ─── 3. Kurs ─────────────────────────────────────────────────────────────────

const HTML_JISDOR = `<html><body><h1>JISDOR</h1><table class="table1">
<tr><th>Tanggal</th><th>Kurs</th></tr>
<tr><td>22 Oktober 2026</td><td>16.234,00</td></tr>
<tr><td>23 Oktober 2026</td><td>Rp 16.251,50</td></tr>
<tr><td>21 Okt 2026</td><td>16.199,00</td></tr>
</table><script>var x = "1 Januari 2099 99.999,00";</script></body></html>`;

function httpTiruan(peta: Record<string, { status?: number; badan?: string; lempar?: boolean }>) {
  const dipanggil: string[] = [];
  const http: PengambilHttp = async (url) => {
    dipanggil.push(url);
    const kunci = Object.keys(peta).find((k) => url.includes(k));
    const j = kunci ? peta[kunci] : { status: 404, badan: "" };
    if (j?.lempar) throw new Error("ECONNREFUSED tiruan");
    return new Response(j?.badan ?? "", { status: j?.status ?? 200 });
  };
  return { http, dipanggil };
}

describe("kurs: JISDOR BI lebih dulu, cadangan sumber terbuka, HTTP tiruan (tanpa situs luar)", () => {
  it("angka kurs format Indonesia/Inggris dan pengurai halaman JISDOR (tanggal terbaru, skrip diabaikan)", () => {
    expect(angkaKurs("16.234,00")).toBe(16234);
    expect(angkaKurs("16,234.50")).toBe(16234.5);
    expect(angkaKurs("16234.5")).toBe(16234.5);
    expect(bacaJisdorBi(HTML_JISDOR)).toBe(16251.5);
    expect(bacaJisdorBi("<p>halaman berubah total</p>")).toBeUndefined();
  });

  it("JISDOR berhasil -> sumber 'JISDOR Bank Indonesia'; JISDOR 503 -> open.er-api.com; semua gagal -> galat terangkum", async () => {
    const a = httpTiruan({ "bi.go.id": { badan: HTML_JISDOR }, "open.er-api.com": { badan: "{}" } });
    expect(await buatPengambilKurs({ http: a.http })()).toEqual({ kurs: 16251.5, sumber: "JISDOR Bank Indonesia" });
    expect(a.dipanggil).toHaveLength(1);

    const b = httpTiruan({ "bi.go.id": { status: 503 }, "open.er-api.com": { badan: JSON.stringify({ result: "success", rates: { IDR: 16300.25 } }) } });
    expect(await buatPengambilKurs({ http: b.http })()).toEqual({ kurs: 16300.25, sumber: "open.er-api.com" });

    const c = httpTiruan({ "bi.go.id": { lempar: true }, "open.er-api.com": { badan: "bukan json" }, "frankfurter.app": { badan: JSON.stringify({ rates: { IDR: 3 } }) } });
    await expect(buatPengambilKurs({ http: c.http })()).rejects.toThrow(/JISDOR Bank Indonesia: .*open\.er-api\.com: nilai tidak terbaca.*frankfurter\.app: nilai tidak terbaca/);
  });

  it("disimpan sekali sehari; pengambilan gagal -> kurs terakhir dipakai (basi)", async () => {
    const db = await createAletaDatabase({ useInMemory: true, seed: false });
    try {
      const hariA = new Date("2026-11-02T02:00:00Z");
      const hariB = new Date("2026-11-03T02:00:00Z");
      const baik = httpTiruan({ "bi.go.id": { badan: HTML_JISDOR } });
      expect(await segarkanKursBilaPerlu(db, { pengambil: buatPengambilKurs({ http: baik.http }), sekarang: hariA })).toBe("diambil");
      expect(await kursBerlaku(db, hariA)).toMatchObject({ kurs: 16251.5, sumber: "JISDOR Bank Indonesia", basi: false });
      const putus = httpTiruan({ "bi.go.id": { lempar: true }, "open.er-api.com": { lempar: true }, "frankfurter.app": { lempar: true } });
      expect(await segarkanKursBilaPerlu(db, { pengambil: buatPengambilKurs({ http: putus.http }), sekarang: hariB })).toBe("gagal");
      expect(await kursBerlaku(db, hariB)).toMatchObject({ kurs: 16251.5, tanggal: "2026-11-02", basi: true });
    } finally {
      await db.close();
    }
  });
});

// ─── 4-8. Berbasis data ──────────────────────────────────────────────────────

describe("dompet ALETA Ai (pg-mem)", () => {
  let db: AletaDatabase;
  const atur = (p: PerubahanPengaturan) => simpanPengaturan(db, superAdmin.id, p);

  beforeAll(async () => {
    db = await dbBaru();
    ctx.db = db;
  }, 180000);

  afterAll(async () => {
    suntikKlienAi(undefined);
    await db?.close();
  });

  afterEach(async () => {
    ulangiBatasLaju();
    await atur({ aktif: true, batasHarianRp: 100_000, batasHarianToken: 3_000_000, batasLajuPerMenit: 6, batasSatkerBulananRp: 5_000_000 });
  });

  async function siapkan(id: string, klien: KlienTiruan, saldo = 100_000) {
    suntikKlienAi(klien);
    if (saldo > 0) await isi(db, id, saldo);
    return (await buatPercakapan(db, id)).id;
  }

  // ── 4. Idempoten di bawah pemanggilan ganda ──
  it("selesaikanTahanan dipanggil 3x BERSAMAAN: satu lepas, satu potong; saldo = jumlah mutasi", async () => {
    const id = "u-ganda-1";
    await isi(db, id, 10_000);
    expect(await tahanDana(db, id, 4000, "g-ganda")).toBe(true);
    const hasil = await Promise.all([selesaikanTahanan(db, id, "g-ganda", 2500), selesaikanTahanan(db, id, "g-ganda", 2500), selesaikanTahanan(db, id, "g-ganda", 2500)]);
    expect(hasil.filter((h) => !h.sudahDiproses)).toHaveLength(1);
    expect(hasil.filter((h) => h.sudahDiproses)).toHaveLength(2);
    expect(await saldoPengguna(db, id)).toBe(7500);
    expect(await jenisMutasi(db, id)).toEqual(["isi:10000", "tahan:-4000", "lepas:4000", "potong:-2500"]);
    expect((await verifikasiSaldo(db, id)).seimbang).toBe(true);
  });

  it("tahanDana {sekali}: dua tahanan bersamaan untuk satu rujukan = satu mutasi; sesudah ditutup tidak menahan lagi", async () => {
    const id = "u-ganda-2";
    await isi(db, id, 10_000);
    expect(await Promise.all([tahanDana(db, id, 3000, "tugas-1", { sekali: true }), tahanDana(db, id, 3000, "tugas-1", { sekali: true })])).toEqual([true, true]);
    expect(await saldoPengguna(db, id)).toBe(7000);
    await selesaikanTahanan(db, id, "tugas-1", 1000);
    expect(await tahanDana(db, id, 3000, "tugas-1", { sekali: true })).toBe(false);
    expect(await jenisMutasi(db, id)).toEqual(["isi:10000", "tahan:-3000", "lepas:3000", "potong:-1000"]);
    // Tanpa opsi: perilaku lama tetap (tambahan tahanan naik tingkat).
    expect(await tahanDana(db, id, 500, "tugas-2")).toBe(true);
    expect(await tahanDana(db, id, 500, "tugas-2")).toBe(true);
    expect(await saldoPengguna(db, id)).toBe(8000);
  });

  // ── 5. Perkiraan sebelum jalan ──
  it("perkiraan sebelum jalan: tidak memanggil model, tidak menahan dana; sama dengan peristiwa 'perkiraan' giliran", async () => {
    const id = "u-perk-1";
    const klien = new KlienTiruan([{ teks: ["Bahwa ", "rekaan."], penggunaan: { masuk: 2000, keluar: 3000, cacheTulis: 10_000 } }]);
    const pc = await siapkan(id, klien);
    const p = await perkirakanPesan(db, hakim(id), pc, { teks: TEKS_DP });
    expect(p).toMatchObject({ label: "Mendalam", bolehJalan: true, gratis: false, saldoRp: 100_000 });
    expect(p.perkiraanRp).toBeGreaterThanOrEqual(1000);
    expect(p.perkiraanRp % 500).toBe(0);
    expect(p.tahanRp).toBeGreaterThanOrEqual(p.perkiraanRp);
    expect(p.kursDipakai).toBeCloseTo(16480, 6);
    expect(klien.jawaban).toBe(0);
    expect(await jenisMutasi(db, id)).toEqual(["isi:100000"]);

    const e = await kumpulkan(kirimPesan(db, hakim(id), pc, { teks: TEKS_DP }));
    expect(e[0]).toEqual({ jenis: "perkiraan", mode: "Mendalam", label: "Mendalam", perkiraanRp: p.perkiraanRp });
    const selesai = e.at(-1) as Extract<EventAi, { jenis: "selesai" }>;
    expect(selesai.jenis).toBe("selesai");
    // Dana ditahan = perkiraan x 1,5; dipotong biaya aktual; selisih kembali.
    const m = await jenisMutasi(db, id);
    expect(m.slice(1)).toEqual([`tahan:-${p.tahanRp}`, `lepas:${p.tahanRp}`, `potong:-${selesai.biayaRp}`]);
    expect(await saldoPengguna(db, id)).toBe(100_000 - selesai.biayaRp);
  });

  it("kurs dan MDR dicatat per giliran (nilai, tanggal, sumber)", async () => {
    const id = "u-kurs-1";
    const pc = await siapkan(id, new KlienTiruan([{ teks: ["x"], penggunaan: { masuk: 2000, keluar: 3000, cacheTulis: 10_000 } }]));
    await kumpulkan(kirimPesan(db, hakim(id), pc, { teks: TEKS_DP }));
    const b = await db.queryOne<Record<string, unknown>>(`SELECT kurs_dasar, kurs, kurs_tanggal, kurs_sumber, biaya_mdr_rp, biaya_rp, biaya_api_rp FROM aleta_ai_obrolan_pesan WHERE pemilik_id = ? AND peran = 'ai'`, [id]);
    expect(b).toMatchObject({ kurs_dasar: 16000, kurs_tanggal: tanggalLokal(), kurs_sumber: "uji", biaya_rp: 3000 });
    expect(Number(b?.kurs)).toBeCloseTo(16480, 6);
    // Opus $0,118 -> MDR = 0,118 x 16.480 x 1,3 x 1%.
    expect(Number(b?.biaya_mdr_rp)).toBeCloseTo(25.28032, 6);
    expect(Number(b?.biaya_api_rp)).toBeCloseTo(1888, 6);
  });

  it("gagal = tidak dipotong: galat layanan sesudah dana ditahan -> tahan dan lepas saja, saldo utuh", async () => {
    const id = "u-gagal-1";
    const pc = await siapkan(id, new KlienTiruan([{ galat: new GalatKlienAi("lain", "Layanan AI sedang gangguan.") }]));
    const e = await kumpulkan(kirimPesan(db, hakim(id), pc, { teks: TEKS_DP }));
    expect(e.at(-1)).toMatchObject({ jenis: "gagal" });
    const m = await jenisMutasi(db, id);
    expect(m.filter((x) => x.startsWith("potong"))).toEqual([]);
    expect(m.filter((x) => x.startsWith("tahan")).length).toBe(1);
    expect(await saldoPengguna(db, id)).toBe(100_000);
  });

  it("saldo kurang: perkiraan menolak dengan alasan; perkiraan tugas T9 memakai rumus yang sama", async () => {
    const id = "u-kurang-1";
    await siapkan(id, new KlienTiruan(), 1000);
    const p = await perkirakanPesan(db, hakim(id), "", { teks: TEKS_DP });
    expect(p.bolehJalan).toBe(false);
    expect(p.alasan).toMatch(/tidak cukup/);
    const t = await perkirakanBiayaTugas(db, hakim(id), { kelompok: "cepat-bantuan", karakterMasuk: 40_000, tokenKeluar: 2000 });
    // Haiku: 10.000 masuk x $0,10 + 2.000 keluar x $0,50 = $0,002 -> minimum Rp1.000
    expect(hitungHarga(0.002, 16000, PARAMETER_HARGA_BAWAAN).tagihRp).toBe(1000);
    expect(t).toMatchObject({ kelompok: "cepat-bantuan", tokenMasuk: 10_000, tokenKeluar: 2000, perkiraanRp: 1000, tahanRp: 1500, bolehJalan: true });
  });

  // ── 6. Batas ──
  it("batas harian RUPIAH ditegakkan SEBELUM jalan atas perkiraan; tepat di batas masih boleh", async () => {
    const id = "u-batas-rp";
    const klien = new KlienTiruan();
    const pc = await siapkan(id, klien);
    const p = await perkirakanPesan(db, hakim(id), pc, { teks: TEKS_DP });
    await atur({ batasHarianRp: p.perkiraanRp - 500 });
    expect((await perkirakanPesan(db, hakim(id), pc, { teks: TEKS_DP })).alasan).toBe(PESAN_BATAS_HARIAN);
    expect(await kumpulkan(kirimPesan(db, hakim(id), pc, { teks: TEKS_DP }))).toEqual([{ jenis: "gagal", pesan: PESAN_BATAS_HARIAN }]);
    expect(klien.jawaban).toBe(0);
    expect(await jenisMutasi(db, id)).toEqual(["isi:100000"]);
    await atur({ batasHarianRp: p.perkiraanRp });
    expect((await kumpulkan(kirimPesan(db, hakim(id), pc, { teks: TEKS_DP }))).at(-1)).toMatchObject({ jenis: "selesai" });
    // Sesudah satu giliran, batas tercapai.
    expect(await kumpulkan(kirimPesan(db, hakim(id), pc, { teks: TEKS_DP }))).toEqual([{ jenis: "gagal", pesan: PESAN_BATAS_HARIAN }]);
  });

  it("batas harian TOKEN juga berlaku untuk Super Admin (gratis dalam batas wajar)", async () => {
    const klien = new KlienTiruan();
    const pc = await siapkan(superAdmin.id, klien, 0);
    await atur({ batasHarianToken: 5000 }); // 4.000 masuk + perkiraan keluaran > 5.000
    expect(await kumpulkan(kirimPesan(db, superAdmin, pc, { teks: TEKS_DP }))).toEqual([{ jenis: "gagal", pesan: PESAN_BATAS_HARIAN }]);
    expect(klien.jawaban).toBe(0);
  });

  it("batas satker per bulan (biaya API seluruh pengguna) menolak siapa pun, termasuk Super Admin", async () => {
    const pc = await siapkan("u-satker", new KlienTiruan());
    await db.run(
      `INSERT INTO aleta_ai_penggunaan (id, pengguna_id, jenis, biaya_api_rp, dibuat_at) VALUES ('aiu-uji-satker', 'u-lain', 'jawaban', 4999000, ?)`,
      [new Date().toISOString()]
    );
    try {
      // 4.999.000 + biaya API perkiraan giliran > 5.000.000
      expect(await kumpulkan(kirimPesan(db, hakim("u-satker"), pc, { teks: TEKS_DP }))).toEqual([{ jenis: "gagal", pesan: PESAN_BATAS_SATKER }]);
      const pcSa = (await buatPercakapan(db, superAdmin.id)).id;
      expect(await kumpulkan(kirimPesan(db, superAdmin, pcSa, { teks: TEKS_DP }))).toEqual([{ jenis: "gagal", pesan: PESAN_BATAS_SATKER }]);
      await atur({ batasSatkerBulananRp: 0 }); // 0 = tanpa batas
      expect((await kumpulkan(kirimPesan(db, hakim("u-satker"), pc, { teks: TEKS_DP }))).at(-1)).toMatchObject({ jenis: "selesai" });
    } finally {
      await db.run(`DELETE FROM aleta_ai_penggunaan WHERE id = 'aiu-uji-satker'`);
    }
  });

  it("batas laju: pesan per menit per pengguna; jendela 60 detik; perkiraan tidak memakai jatah", async () => {
    const t0 = 1_800_000_000_000;
    expect([izinkanLaju("u-laju", 2, t0), izinkanLaju("u-laju", 2, t0 + 1), izinkanLaju("u-laju", 2, t0 + 2)]).toEqual([true, true, false]);
    expect(izinkanLaju("u-laju", 2, t0 + 60_001)).toBe(true);
    ulangiBatasLaju();
    const id = "u-laju-2";
    const pc = await siapkan(id, new KlienTiruan());
    await atur({ batasLajuPerMenit: 1 });
    for (let i = 0; i < 3; i += 1) expect((await perkirakanPesan(db, hakim(id), pc, { teks: TEKS_DP })).bolehJalan).toBe(true);
    expect((await kumpulkan(kirimPesan(db, hakim(id), pc, { teks: TEKS_DP }))).at(-1)).toMatchObject({ jenis: "selesai" });
    expect((await kumpulkan(kirimPesan(db, hakim(id), pc, { teks: TEKS_DP }))).at(-1)).toMatchObject({ jenis: "gagal", pesan: expect.stringMatching(/Terlalu banyak pesan/) });
  });

  // ── 7. Saklar darurat ──
  it("saklar darurat dimatikan DI TENGAH jawaban: giliran berhenti seketika, tidak dipotong, tahanan kembali", async () => {
    const id = "u-saklar-1";
    const klien = new KlienTiruan([{ teks: ["Bahwa ", "kalimat ", "yang ", "tidak ", "sampai."], sesudahTeksPertama: async () => void (await atur({ aktif: false })) }]);
    const pc = await siapkan(id, klien);
    const e = await kumpulkan(kirimPesan(db, hakim(id), pc, { teks: TEKS_DP }));
    expect(e.map((x) => x.jenis)).toEqual(["perkiraan", "teks", "gagal"]);
    expect(e.at(-1)).toEqual({ jenis: "gagal", pesan: PESAN_NONAKTIF_SAKLAR });
    expect(await saldoPengguna(db, id)).toBe(100_000);
    expect((await jenisMutasi(db, id)).filter((x) => x.startsWith("potong"))).toEqual([]);
    expect(await aletaAiDihentikan(db)).toBe(true);
    // Selama mati: giliran baru dan perkiraan ditolak.
    expect(await kumpulkan(kirimPesan(db, hakim(id), pc, { teks: TEKS_DP }))).toEqual([{ jenis: "gagal", pesan: PESAN_NONAKTIF_SAKLAR }]);
    expect((await perkirakanPesan(db, hakim(id), pc, { teks: TEKS_DP })).bolehJalan).toBe(false);
    expect(jumlahPekerjaanAiBerjalan()).toBe(0);
  });

  it("tugas T9 (di luar mesin): pekerjaan terdaftar dibatalkan saat saklar dimatikan; pantauSaklar menangkap saklar dari proses lain", async () => {
    const tugas = new AbortController();
    const lepas = daftarkanPekerjaanAi(tugas);
    await atur({ aktif: false });
    expect(tugas.signal.aborted).toBe(true);
    expect(tugas.signal.reason).toBe(ALASAN_SAKLAR);
    lepas();
    await atur({ aktif: true });
    expect(await aletaAiDihentikan(db)).toBe(false);

    // Proses lain mematikan saklar langsung di basis data: pemantauan berkala menghentikan tugas.
    const tugas2 = new AbortController();
    const henti = pantauSaklar(db, tugas2, { selangMs: 50 });
    await db.run(`UPDATE aleta_ai_pengaturan SET nilai = '0' WHERE kunci = 'aktif'`);
    await vi.waitFor(() => expect(tugas2.signal.aborted).toBe(true), { timeout: 3000, interval: 25 });
    expect(tugas2.signal.reason).toBe(ALASAN_SAKLAR);
    henti();
    expect(jumlahPekerjaanAiBerjalan()).toBe(0);
  });

  // ── 8. Kuota hibah ──
  it("kuota per peran: mutasi 'kuota' sekali per bulan walau dipanggil bersamaan; bulan berikut lagi; Super Admin tidak", async () => {
    await simpanKuotaPeran(db, superAdmin.id, [{ peranId: "hakim", kuotaBulananRp: 20_000 }]);
    const id = "u-kuota-1";
    const okt = new Date("2026-10-15T02:00:00Z");
    const hasil = await Promise.all([1, 2, 3].map(() => pastikanKuotaBulanIni(db, hakim(id), okt)));
    expect(hasil.sort()).toEqual([0, 0, 20_000]);
    expect(await pastikanKuotaBulanIni(db, hakim(id), new Date("2026-11-01T02:00:00Z"))).toBe(20_000);
    // Sisa kuota Oktober (belum terpakai) hangus lebih dulu, baru kuota November diberikan.
    expect(await jenisMutasi(db, id)).toEqual(["kuota:20000", "kuota-hangus:-20000", "kuota:20000"]);
    expect((await daftarMutasi(db, id)).map((m) => m.rujukanId).sort()).toEqual(["kuota-hangus:2026-10", "kuota:2026-10:hakim", "kuota:2026-11:hakim"]);
    expect(await pastikanKuotaBulanIni(db, superAdmin, okt)).toBe(0);
    await expect(simpanKuotaPeran(db, superAdmin.id, [{ peranId: "hakim", kuotaBulananRp: -1 }])).rejects.toMatchObject({ status: 400 });
    await simpanKuotaPeran(db, superAdmin.id, [{ peranId: "hakim", kuotaBulananRp: 0 }]);
    expect(await pastikanKuotaBulanIni(db, hakim("u-kuota-2"), okt)).toBe(0);
  });

  it("kuota HANGUS akhir bulan: kuota dipakai lebih dulu, sisa ditarik saat pergantian bulan WITA, saldo isi tidak ikut; idempoten", async () => {
    const bulanIni = tanggalLokal().slice(0, 7);
    const [t, b] = bulanIni.split("-").map(Number) as [number, number];
    const bulanDepan = new Date(Date.UTC(t, b, 1, 2)); // tgl 1 bulan berikut, 10.00 WITA
    const akhirBulanWita = new Date(Date.UTC(t, b - 1 + 1, 0, 15, 59)); // hari terakhir, 23.59 WITA
    await simpanKuotaPeran(db, superAdmin.id, [{ peranId: "hakim", kuotaBulananRp: 20_000 }]);
    try {
      // A: kuota 20.000 + isi 5.000; terpakai 3.000 -> dari kuota. Bulan depan: 17.000 hangus, isi 5.000 tetap.
      const a = "u-hangus-a";
      expect(await pastikanKuotaBulanIni(db, hakim(a))).toBe(20_000);
      await isi(db, a, 5000);
      await tahanDana(db, a, 4500, "aip-hangus-a");
      await selesaikanTahanan(db, a, "aip-hangus-a", 3000);
      const d = await tampilDompet(db, hakim(a));
      expect(d.kuota).toMatchObject({ diberikanRp: 20_000, terpakaiRp: 3000, sisaRp: 17_000 });
      expect(d.kuota?.teks).toBe(`Kuota bulan ini Rp17.000, hangus ${tanggalHangus(bulanIni).replace(/ \d{4}$/, "")}.`);
      // Masih bulan yang sama (23.59 WITA hari terakhir): belum hangus.
      await pastikanKuotaBulanIni(db, hakim(a), akhirBulanWita);
      expect(await saldoPengguna(db, a)).toBe(22_000);
      // Pergantian bulan, dipanggil tiga kali bersamaan: satu hangus, satu kuota baru.
      const r = await Promise.all([1, 2, 3].map(() => pastikanKuotaBulanIni(db, hakim(a), bulanDepan)));
      expect(r.sort((x, y) => x - y)).toEqual([0, 0, 20_000]);
      const m = await jenisMutasi(db, a);
      expect(m).toEqual(["kuota:20000", "isi:5000", "tahan:-4500", "lepas:4500", "potong:-3000", "kuota-hangus:-17000", "kuota:20000"]);
      expect(await saldoPengguna(db, a)).toBe(5000 + 20_000);
      expect((await daftarMutasi(db, a)).find((x) => x.jenis === "kuota-hangus")?.catatan).toBe(`Sisa kuota ${bulanIni} hangus`);
      expect((await verifikasiSaldo(db, a)).seimbang).toBe(true);

      // B: pemakaian melebihi kuota -> sisanya dari saldo isi; tidak ada yang hangus (penanda Rp0 tidak tampil).
      const bb = "u-hangus-b";
      await pastikanKuotaBulanIni(db, hakim(bb));
      await isi(db, bb, 10_000);
      await tahanDana(db, bb, 25_000, "aip-hangus-b");
      await selesaikanTahanan(db, bb, "aip-hangus-b", 25_000);
      expect((await tampilDompet(db, hakim(bb))).kuota).toMatchObject({ terpakaiRp: 20_000, sisaRp: 0 });
      await Promise.all([pastikanKuotaBulanIni(db, hakim(bb), bulanDepan), pastikanKuotaBulanIni(db, hakim(bb), bulanDepan)]);
      expect(await saldoPengguna(db, bb)).toBe(5000 + 20_000);
      expect((await jenisMutasi(db, bb)).filter((x) => x.startsWith("kuota-hangus"))).toEqual([]);
      expect(await db.queryAll(`SELECT jumlah_rp FROM aleta_ai_mutasi WHERE pengguna_id = ? AND jenis = 'kuota-hangus'`, [bb])).toHaveLength(1);

      // C: peran tidak berkuota lagi -> sisa bulan lalu tetap hangus, kuota baru tidak diberikan.
      const c = "u-hangus-c";
      await pastikanKuotaBulanIni(db, hakim(c));
      await simpanKuotaPeran(db, superAdmin.id, [{ peranId: "hakim", kuotaBulananRp: 0 }]);
      expect(await pastikanKuotaBulanIni(db, hakim(c), bulanDepan)).toBe(0);
      expect(await jenisMutasi(db, c)).toEqual(["kuota:20000", "kuota-hangus:-20000"]);
      expect(await saldoPengguna(db, c)).toBe(0);
    } finally {
      await simpanKuotaPeran(db, superAdmin.id, [{ peranId: "hakim", kuotaBulananRp: 0 }]);
    }
  });

  it("koreksi saldo: alasan wajib, tidak boleh negatif, idempoten per kunci, tampil 'Koreksi oleh admin', masuk audit/laporan/rekonsiliasi", async () => {
    const id = "u-koreksi-1";
    const ada = async (x: string) => x === id;
    await isi(db, id, 10_000);
    const dasar = { penggunaId: id, jumlahRp: -3000 };
    await expect(koreksiSaldo(db, superAdmin.id, { ...dasar, alasan: "" }, ada)).rejects.toMatchObject({ status: 400 });
    await expect(koreksiSaldo(db, superAdmin.id, { ...dasar, alasan: "    " }, ada)).rejects.toMatchObject({ status: 400 });
    await expect(koreksiSaldo(db, superAdmin.id, { ...dasar, jumlahRp: 0, alasan: "salah ketik" }, ada)).rejects.toMatchObject({ status: 400 });
    await expect(koreksiSaldo(db, superAdmin.id, { ...dasar, jumlahRp: -10_001, alasan: "terlalu banyak" }, ada)).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/tidak boleh menjadi negatif/),
    });
    await expect(koreksiSaldo(db, superAdmin.id, { ...dasar, penggunaId: "tidak-ada", alasan: "salah ketik" }, ada)).rejects.toMatchObject({ status: 404 });
    expect(await jenisMutasi(db, id)).toEqual(["isi:10000"]);

    // Dua kiriman bersamaan dengan kunci yang sama = satu mutasi.
    const kunci = "kunci-koreksi-0001";
    const dua = await Promise.all([1, 2].map(() => koreksiSaldo(db, superAdmin.id, { ...dasar, alasan: "salah ketik isi 20 Okt", kunci }, ada)));
    expect(dua.map((h) => h.sudahAda).sort()).toEqual([false, true]);
    expect(dua.map((h) => h.saldoRp)).toEqual([7000, 7000]);
    await expect(koreksiSaldo(db, superAdmin.id, { ...dasar, jumlahRp: -2000, alasan: "salah ketik isi 20 Okt", kunci }, ada)).rejects.toMatchObject({ status: 409 });
    expect((await koreksiSaldo(db, superAdmin.id, { penggunaId: id, jumlahRp: 500, alasan: "pembulatan dikembalikan" }, ada)).saldoRp).toBe(7500);
    expect(await jenisMutasi(db, id)).toEqual(["isi:10000", "koreksi:-3000", "koreksi:500"]);

    const d = await tampilDompet(db, hakim(id));
    expect(d.mutasi.map((m) => m.keterangan)).toEqual(["Koreksi oleh admin: pembulatan dikembalikan", "Koreksi oleh admin: salah ketik isi 20 Okt", "uji"]);
    const struk = await strukMutasi(db, hakim(id), d.mutasi[1]!.id);
    expect(struk).toContain("Koreksi oleh admin: salah ketik isi 20 Okt");
    expect(struk).toContain("-Rp3.000");
    await expect(strukMutasi(db, hakim("orang-lain"), d.mutasi[1]!.id)).rejects.toMatchObject({ status: 404 });

    const jejak = await db.queryAll<{ ringkas: string }>(`SELECT ringkas FROM aleta_ai_jejak WHERE aksi = 'saldo.koreksi' AND ringkas LIKE ?`, [`%${id}%`]);
    expect(jejak.map((j) => j.ringkas)).toEqual(expect.arrayContaining([expect.stringContaining("-Rp3000; alasan: salah ketik isi 20 Okt")]));
    expect(jejak).toHaveLength(2); // kiriman ulang tidak menulis jejak kedua
    expect((await laporanBulanan(db)).mutasiSaldo).toMatchObject({ koreksiTambahRp: expect.any(Number), koreksiKurangRp: expect.any(Number) });
    const lap = await laporanBulanan(db);
    expect(lap.mutasiSaldo.koreksiKurangRp).toBeGreaterThanOrEqual(3000);
    expect(lap.mutasiSaldo.koreksiTambahRp).toBeGreaterThanOrEqual(500);
    expect(laporanKeCsv(lap)).toContain("Mutasi saldo,Koreksi admin (kurang),");
    const rek = await jalankanRekonsiliasi(db, {});
    expect(rek.rincian.filter((r) => r.jenis === "saldo" || r.jenis === "rantai")).toEqual([]);
  });

  it("isi saldo berbayar MATI bawaan dan tidak dapat dinyalakan (tahap 5); pengaturan MDR tersimpan dalam rentang", async () => {
    expect((await bacaPengaturan(db)).isiBerbayarAktif).toBe(false);
    await expect(atur({ isiBerbayarAktif: true })).rejects.toMatchObject({ status: 400 });
    await expect(atur({ mdrPersen: 6 })).rejects.toMatchObject({ status: 400 });
    expect((await bacaPengaturan(db)).mdrPersen).toBe(1);
    expect((await atur({ mdrPersen: 0.7 })).mdrPersen).toBe(0.7); // tetap dapat diubah Super Admin
    expect((await atur({ mdrPersen: 1 })).mdrPersen).toBe(1);
  });

  // ── 10. Dompet & struk ──
  it("dompet: rincian per giliran tanpa nama model (kecuali Super Admin), saldo menipis, struk HTML tanpa isi pesan", async () => {
    const id = "u-dompet-1";
    const pc = await siapkan(id, new KlienTiruan([{ teks: ["Rahasia musyawarah rekaan."], penggunaan: { masuk: 2000, keluar: 3000, cacheTulis: 10_000 } }]), 6000);
    await kumpulkan(kirimPesan(db, hakim(id), pc, { teks: TEKS_DP }));
    const d = await tampilDompet(db, hakim(id));
    expect(d).toMatchObject({ saldoRp: 3000, saldoMenipis: true, isiBerbayarAktif: false, gratis: false, hariIni: { terpakaiRp: 3000 } });
    expect(d.pemberitahuan).toMatch(/Rp3\.000/);
    expect(d.giliran).toHaveLength(1);
    expect(d.giliran[0]).toMatchObject({ mode: "Mendalam", status: "selesai", biayaRp: 3000, kursDasar: 16000, kursSumber: "uji" });
    expect(d.giliran[0]).not.toHaveProperty("model");
    expect(d.mutasi[0]).toMatchObject({ jenis: "potong", keterangan: "Biaya giliran", saldoSesudahRp: 3000 });
    const html = await strukGiliran(db, hakim(id), d.giliran[0]!.pesanId);
    expect(html).toContain("Rp3.000");
    expect(html).toContain(d.giliran[0]!.pesanId);
    expect(html).not.toContain("Rahasia musyawarah");
    expect(html).not.toMatch(/claude-|opus|sonnet|haiku/i);
    await expect(strukGiliran(db, hakim("orang-lain"), d.giliran[0]!.pesanId)).rejects.toMatchObject({ status: 404 });
  });
});

// ─── 9. Laporan & rekonsiliasi (basis data tersendiri) ───────────────────────

describe("laporan laba = jumlah mutasi; ekspor; rekonsiliasi menandai selisih", () => {
  let db: AletaDatabase;

  beforeAll(async () => {
    db = await dbBaru();
    ctx.db = db;
    const kiriman: Array<[string, Partial<PenggunaanToken>]> = [
      ["u-lap-1", { masuk: 2000, keluar: 3000, cacheTulis: 10_000 }],
      ["u-lap-1", { masuk: 50_000, keluar: 9000 }],
      ["u-lap-2", { masuk: 1000, keluar: 200 }],
    ];
    for (const [id, penggunaan] of kiriman) {
      suntikKlienAi(new KlienTiruan([{ teks: ["x"], penggunaan }]));
      if ((await saldoPengguna(db, id)) === 0) await isi(db, id, 100_000);
      const pc = (await buatPercakapan(db, id)).id;
      await kumpulkan(kirimPesan(db, hakim(id), pc, { teks: TEKS_DP }));
    }
    suntikKlienAi(new KlienTiruan([{ teks: ["x"], penggunaan: { masuk: 3000, keluar: 3000 } }]));
    await kumpulkan(kirimPesan(db, superAdmin, (await buatPercakapan(db, superAdmin.id)).id, { teks: TEKS_DP }));
    ulangiBatasLaju();
  }, 180000);

  afterAll(async () => {
    suntikKlienAi(undefined);
    await db?.close();
  });

  it("pendapatan = jumlah potongan di buku mutasi; laba = pendapatan - biaya API - MDR; per bulan = total", async () => {
    const lap = await laporanBulanan(db);
    const potong = await db.queryOne<{ n: number | string }>(`SELECT COALESCE(SUM(jumlah_rp), 0) AS n FROM aleta_ai_mutasi WHERE jenis = 'potong'`);
    expect(lap.pendapatanRp).toBe(-Number(potong?.n));
    expect(lap.pendapatanRp).toBeGreaterThan(0);
    expect(lap.biayaMdrRp).toBeGreaterThan(0);
    expect(lap.labaRp).toBeCloseTo(lap.pendapatanRp - lap.biayaApiRp - lap.biayaMdrRp, 6);
    expect(lap.ringkasan).toMatchObject({ giliran: 4, gratis: 1 });
    expect(lap.perBulan).toHaveLength(1);
    expect(lap.perBulan[0]).toMatchObject({ bulan: tanggalLokal().slice(0, 7), pendapatanRp: lap.pendapatanRp, labaRp: lap.labaRp });
    const jumlahPengguna = lap.perPengguna.reduce((n, r) => n + r.pendapatanRp, 0);
    expect(jumlahPengguna).toBe(lap.pendapatanRp);
    await expect(laporanRentang(db, "2026-10", "2026-09")).rejects.toMatchObject({ status: 400 });
    await expect(laporanRentang(db, "2024-01", "2026-12")).rejects.toMatchObject({ status: 400 });
  });

  it("ekspor CSV (aman dari formula) dan XLSX (berkas zip)", async () => {
    const lap = await laporanBulanan(db);
    const csv = laporanKeCsv(lap);
    const baris = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(baris[0]).toBe("Bagian,Nama,Giliran,Giliran gratis,Token,Biaya API (USD),Biaya API (Rp),Biaya MDR (Rp),Pendapatan (Rp),Laba (Rp)");
    expect(baris[1]?.split(",")[8]).toBe(String(lap.pendapatanRp));
    expect(baris.some((b) => b.startsWith("Per model,claude-opus-5-5,"))).toBe(true);
    const tiruan = { ...lap, perPengguna: [{ ...lap.perPengguna[0]!, nama: "=HYPERLINK(1)" }] };
    expect(laporanKeCsv(tiruan)).toContain("'=HYPERLINK(1)");
    const xlsx = laporanKeXlsx(lap);
    expect(xlsx.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("rekonsiliasi: seimbang; tahanan menggantung ditandai; saldo diubah di luar mutasi -> selisih; pendapatan tak cocok -> selisih", async () => {
    const r1 = await jalankanRekonsiliasi(db, { olehId: superAdmin.id });
    expect(r1).toMatchObject({ status: "seimbang", jumlahSelisih: 0, tahananMenggantung: 0 });
    expect(r1.pendapatanGiliranRp).toBe(r1.potongMutasiRp);

    await tahanDana(db, "u-lap-2", 1500, "aip-ditinggal");
    const nanti = new Date(Date.now() + 3 * 3600_000);
    const r2 = await jalankanRekonsiliasi(db, { tanggal: tanggalLokal(), sekarang: nanti });
    expect(r2).toMatchObject({ status: "menggantung", tahananMenggantung: 1, jumlahSelisih: 0 });
    expect(r2.rincian).toEqual([expect.objectContaining({ jenis: "tahanan", penggunaId: "u-lap-2", rujukanId: "aip-ditinggal", ditahanRp: 1500 })]);
    await selesaikanTahanan(db, "u-lap-2", "aip-ditinggal", 0);

    await db.run(`UPDATE aleta_ai_saldo SET saldo_rp = saldo_rp + 777 WHERE pengguna_id = 'u-lap-1'`);
    await db.run(`UPDATE aleta_ai_obrolan_pesan SET biaya_rp = biaya_rp + 500 WHERE id = (SELECT id FROM aleta_ai_obrolan_pesan WHERE pemilik_id = 'u-lap-2' AND peran = 'ai' LIMIT 1)`);
    const r3 = await jalankanRekonsiliasi(db, { olehId: superAdmin.id });
    expect(r3.status).toBe("selisih");
    expect(r3.rincian).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ jenis: "saldo", penggunaId: "u-lap-1", selisihRp: 777 }),
        expect.objectContaining({ jenis: "pendapatan", selisihRp: 500 }),
      ])
    );
    // Satu baris per tanggal (diperbarui, bukan ditambah).
    const baris = await db.queryAll<{ id: string; status: string }>(`SELECT id, status FROM aleta_ai_rekonsiliasi`);
    expect(baris).toEqual([{ id: `rek-${tanggalLokal()}`, status: "selisih" }]);
  });
});

// ─── 10. Hak per peran di rute (pengguna nyata di pg-mem, tanpa tiruan akses) ─

describe("hak per peran di rute dompet (matriks peran + Akses Menu + wajibSuperAdmin)", () => {
  let db: AletaDatabase;
  const req = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(`http://localhost${url}`, init);
  const status = async (r: Response) => ({ status: r.status, isi: r.headers.get("content-type")?.includes("json") ? ((await r.json()) as { ok: boolean; data?: unknown; error?: { message: string } }) : null });

  beforeAll(async () => {
    db = await dbBaru();
    ctx.db = db;
    const kini = new Date().toISOString();
    for (const r of ["hakim", "admin", "super-admin"]) await db.run(`INSERT INTO roles (id, name, description) VALUES (?, ?, '')`, [r, r]);
    await db.run(`INSERT INTO positions (id, name, unit_kerja, level_hierarchy, created_at, updated_at) VALUES ('pos-uji', 'Uji', 'Uji', 1, ?, ?)`, [kini, kini]);
    for (const [id, peran] of [
      ["u-hakim", "hakim"],
      ["u-admin", "admin"],
      ["u-sa", "super-admin"],
    ]) {
      await db.run(
        `INSERT INTO users (id, username, password_hash, name, email, whatsapp_number, role_id, position_id, created_at, updated_at) VALUES (?, ?, 'x', ?, ?, '0', ?, 'pos-uji', ?, ?)`,
        [id, id, `Nama ${id}`, `${id}@rekaan.test`, peran, kini, kini]
      );
    }
  }, 180000);

  afterAll(async () => {
    suntikKlienAi(undefined);
    await db?.close();
  });

  it("tanpa sesi: 401", async () => {
    ctx.aktor = null;
    const { GET } = await import("@/app/api/aleta-ai/dompet/route");
    expect((await GET(req("/api/aleta-ai/dompet"))).status).toBe(401);
  });

  it("dompet & perkiraan: hakim 403 selama ALETA Ai belum dibuka untuk perannya; dibuka lewat Akses Menu -> 200 milik sendiri", async () => {
    const { GET } = await import("@/app/api/aleta-ai/dompet/route");
    const { POST: perkiraan } = await import("@/app/api/aleta-ai/perkiraan/route");
    ctx.aktor = "u-hakim";
    const tolak = await status(await GET(req("/api/aleta-ai/dompet")));
    expect(tolak.status).toBe(403);
    expect(tolak.isi?.error?.message).toMatch(/belum dibuka untuk peran Anda/);
    expect((await perkiraan(req("/api/aleta-ai/perkiraan", { method: "POST", body: JSON.stringify({ teks: TEKS_DP }) }))).status).toBe(403);

    await db.run(`INSERT INTO module_visibility_settings (role_id, module_id, enabled, updated_at) VALUES ('hakim', 'buka:aleta-ai', 1, ?)`, [new Date().toISOString()]);
    await isi(db, "u-hakim", 50_000);
    const boleh = await status(await GET(req("/api/aleta-ai/dompet")));
    expect(boleh.status).toBe(200);
    expect(boleh.isi?.data).toMatchObject({ saldoRp: 50_000, isiBerbayarAktif: false, giliran: [] });
    suntikKlienAi(new KlienTiruan());
    const p = await status(await perkiraan(req("/api/aleta-ai/perkiraan", { method: "POST", body: JSON.stringify({ teks: TEKS_DP }) })));
    expect(p.status).toBe(200);
    expect(p.isi?.data).toMatchObject({ label: "Mendalam", bolehJalan: true, saldoRp: 50_000 });
    expect(JSON.stringify(p.isi?.data)).not.toMatch(/claude-|kelompok/);
    expect(await jenisMutasi(db, "u-hakim")).toEqual(["isi:50000"]);
  });

  it("kuota, rekonsiliasi, ekspor laporan: hakim 403, Admin 403, Super Admin 200", async () => {
    const kuota = await import("@/app/api/aleta-ai/kuota/route");
    const rekon = await import("@/app/api/aleta-ai/rekonsiliasi/route");
    const ekspor = await import("@/app/api/aleta-ai/laporan/ekspor/route");
    const panggil = () => [
      kuota.GET(req("/api/aleta-ai/kuota")),
      kuota.PUT(req("/api/aleta-ai/kuota", { method: "PUT", body: JSON.stringify({ kuota: [{ peranId: "hakim", kuotaBulananRp: 5000 }] }) })),
      kuota.POST(req("/api/aleta-ai/kuota", { method: "POST" })),
      rekon.GET(req("/api/aleta-ai/rekonsiliasi")),
      rekon.POST(req("/api/aleta-ai/rekonsiliasi", { method: "POST", body: "{}" })),
      ekspor.GET(req("/api/aleta-ai/laporan/ekspor?format=csv")),
    ];
    for (const aktor of ["u-hakim", "u-admin"]) {
      ctx.aktor = aktor;
      for (const r of await Promise.all(panggil())) expect(r.status, aktor).toBe(403);
    }
    expect(await db.queryAll(`SELECT * FROM aleta_ai_kuota_peran`)).toEqual([]);
    ctx.aktor = "u-sa";
    const hasil = await Promise.all(panggil());
    expect(hasil.map((r) => r.status)).toEqual([200, 200, 200, 200, 200, 200]);
    expect(hasil[5]?.headers.get("content-type")).toMatch(/text\/csv/);
    expect(hasil[5]?.headers.get("content-disposition")).toMatch(/laporan-aleta-ai-\d{4}-\d{2}\.csv/);
    expect((await db.queryAll(`SELECT peran_id, kuota_bulanan_rp FROM aleta_ai_kuota_peran`)).map((b) => ({ ...b, kuota_bulanan_rp: Number((b as { kuota_bulanan_rp: unknown }).kuota_bulanan_rp) }))).toEqual([
      { peran_id: "hakim", kuota_bulanan_rp: 5000 },
    ]);
  });

  it("koreksi saldo lewat rute: hakim 403, Admin 403, Super Admin 200; alasan kosong 400; tercatat di mutasi pengguna", async () => {
    const { POST } = await import("@/app/api/aleta-ai/saldo/koreksi/route");
    const kirim = (badan: unknown) => POST(req("/api/aleta-ai/saldo/koreksi", { method: "POST", body: JSON.stringify(badan) }));
    const badan = { penggunaId: "u-hakim", jumlahRp: -1000, alasan: "koreksi uji rute", kunci: "kunci-rute-00001" };
    for (const aktor of ["u-hakim", "u-admin"]) {
      ctx.aktor = aktor;
      expect((await kirim(badan)).status, aktor).toBe(403);
    }
    ctx.aktor = "u-sa";
    expect((await kirim({ ...badan, alasan: "" })).status).toBe(400);
    const sebelum = await saldoPengguna(db, "u-hakim");
    const r = await status(await kirim(badan));
    expect(r.status).toBe(200);
    expect(r.isi?.data).toMatchObject({ saldoRp: sebelum - 1000, sudahAda: false });
    expect((await status(await kirim(badan))).isi?.data).toMatchObject({ saldoRp: sebelum - 1000, sudahAda: true });
    expect((await daftarMutasi(db, "u-hakim"))[0]).toMatchObject({ jenis: "koreksi", jumlahRp: -1000, catatan: "Koreksi oleh admin: koreksi uji rute" });
  });

  it("struk: hanya giliran milik sendiri (orang lain 404), HTML tanpa isi pesan", async () => {
    ctx.aktor = "u-hakim";
    suntikKlienAi(new KlienTiruan([{ teks: ["Isi rahasia rekaan."], penggunaan: { masuk: 1000, keluar: 500 } }]));
    const pc = (await buatPercakapan(db, "u-hakim")).id;
    const e = await kumpulkan(kirimPesan(db, hakim("u-hakim"), pc, { teks: TEKS_DP }));
    const pesanId = (e.at(-1) as Extract<EventAi, { jenis: "selesai" }>).pesanId;
    const { GET } = await import("@/app/api/aleta-ai/struk/[id]/route");
    const r = await GET(req(`/api/aleta-ai/struk/${pesanId}`), { params: Promise.resolve({ id: pesanId }) });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/text\/html/);
    const html = await r.text();
    expect(html).toContain(pesanId);
    expect(html).not.toContain("Isi rahasia");
    ctx.aktor = "u-sa";
    expect((await GET(req(`/api/aleta-ai/struk/${pesanId}`), { params: Promise.resolve({ id: pesanId }) })).status).toBe(404);
  });
});
