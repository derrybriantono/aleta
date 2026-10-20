// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { crc32, deflateRawSync } from "node:zlib";

import { newDb } from "pg-mem";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  bulatkanKeAtas,
  biayaUsd,
  biayaUsdBanyak,
  hitungHarga,
  kursEfektif,
  MODEL_HAIKU,
  MODEL_OPUS,
  MODEL_SONNET,
  perkirakanTokenDariKarakter,
  TARIF_BAWAAN,
  type PenggunaanToken,
  type Tarif,
} from "@/lib/aleta-ai/biaya";
import { rakitBlokModul, susunPermintaan, susunRiwayat } from "@/lib/aleta-ai/penyusun";
import { bacaMenuPemicu, cariPemicuDiAwalTeks, isiPemicuModul, pilihModul, type ModulProyek } from "@/lib/aleta-ai/proyek";
import {
  klasifikasiKataKunci,
  naikSatuTingkat,
  pilihRute,
  RUTE_BAWAAN,
  tabelRuteDari,
  tafsirKeluaranPengklasifikasi,
} from "@/lib/aleta-ai/rute";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_ALETA_AI } from "@/server/db/schema";
import type { PelakuAi } from "@/server/modules/aleta-ai/akses";
import {
  GalatKlienAi,
  iterasiDariUsage,
  suntikKlienAi,
  type HasilAi,
  type KlienAi,
  type OpsiAlir,
} from "@/server/modules/aleta-ai/klien";
import { kursBerlaku, segarkanKursBilaPerlu, simpanKurs, tanggalLokal } from "@/server/modules/aleta-ai/kurs";
import { ringkasAi } from "@/server/modules/aleta-ai/layanan";
import { laporanBulanan } from "@/server/modules/aleta-ai/laporan";
import {
  CATATAN_TERPOTONG,
  izinkanLaju,
  kirimPesan,
  PESAN_DITOLAK,
  PESAN_NONAKTIF_KUNCI,
  PESAN_NONAKTIF_PROYEK,
  PESAN_NONAKTIF_SAKLAR,
  ulangiBatasLaju,
  type EventAi,
} from "@/server/modules/aleta-ai/mesin";
import { ambilPercakapan, buatPercakapan, daftarPercakapan, sembunyikanPercakapan, ubahJudul } from "@/server/modules/aleta-ai/percakapan";
import { bacaPengaturan, bacaRute, bacaTarif, simpanPengaturan, simpanRute, simpanTarif } from "@/server/modules/aleta-ai/pengaturan";
import { bacaProyekDariZip, proyekAktif, unggahProyek } from "@/server/modules/aleta-ai/proyek";
import { daftarMutasi, isiSaldo, saldoPengguna, selesaikanTahanan, tahanDana, terapkanMutasi, verifikasiSaldo } from "@/server/modules/aleta-ai/saldo";
import { aliranSse } from "@/server/modules/aleta-ai/sse";
import { susunZip } from "@/server/shared/zip";

/**
 * ============================================================================
 * ALETA Ai TAHAP 1 (server), 20 Okt 2026
 * ============================================================================
 *
 * Tanpa jaringan dan tanpa kunci API: klien Claude TIRUAN disuntik. Isi proyek
 * V4.5 yang sungguhan TIDAK dipakai di sini - hanya fixture rekaan kecil.
 *
 *   1. migrasi 0078: berkas = DDL schema.ts, jurnal tanpa lubang, ikut cadangan
 *   2. biaya: tarif, kurs + penyangga, margin, pembulatan Rp500, minimum Rp1.000
 *   3. rute model per kelompok dan batas peran, pengklasifikasi, naik tingkat
 *   4. proyek: unggah ZIP -> modul + pemicu, lampiran, versi
 *   5. penyusun permintaan: system ber-cache, riwayat, modul menurut pemicu
 *   6. saldo: tahan-lepas-potong seimbang
 *   7. mesin SSE: urutan peristiwa, refusal, batas token, galat, putus tengah jalan
 *   8. hak: tanpa kunci -> nonaktif; Super Admin tidak membaca isi orang lain
 *   9. rute HTTP: kontrak bentuk jawaban
 */

const ctx = vi.hoisted(() => ({ db: null as unknown, pelaku: null as unknown }));

vi.mock("@/server/db/client", async (asli) => ({
  ...(await asli<typeof import("@/server/db/client")>()),
  getDatabase: async () => ctx.db,
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "uji" }));
vi.mock("@/server/modules/aleta-ai/akses", async (asli) => ({
  ...(await asli<typeof import("@/server/modules/aleta-ai/akses")>()),
  pelakuAi: async () => ctx.pelaku,
}));

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

const hakim: PelakuAi = { id: "usr-hakim", nama: "Hakim Rekaan", peranId: "hakim", superAdmin: false };
const hakim2: PelakuAi = { id: "usr-hakim-2", nama: "Hakim Dua", peranId: "hakim", superAdmin: false };
const pp: PelakuAi = { id: "usr-pp", nama: "PP Rekaan", peranId: "panitera-pengganti", superAdmin: false };
const superAdmin: PelakuAi = { id: "usr-super", nama: "Super Rekaan", peranId: "super-admin", superAdmin: true };

// ─── Fixture ZIP proyek rekaan ───────────────────────────────────────────────

const MENU_MD = `# ALETA_05 — TRIGGER MENU LENGKAP
Modul rekaan untuk uji.

## KELOMPOK A — DRAFTING UTAMA
| Trigger | Output |
|---|---|
| Duduk Perkara | Ringkasan "Bahwa" rekaan |
| Pertimbangan / PT | Pertimbangan hukum berlapis rekaan |
| Putusan Lengkap / PL | Kepala sampai penutup rekaan (ALETA_08) |

## KELOMPOK C — PROSES SIDANG
| Trigger | Output |
|---|---|
| SIDANG [agenda] · PANDUAN SIDANG · persiapan sidang | Panduan rekaan (ALETA_13) |

## KELOMPOK F — KALKULATOR
| Trigger | Output |
|---|---|
| Kalkulator Nafkah / KN | Hitung iddah rekaan (ALETA_04 bagian 3) |

## KELOMPOK I — UTILITAS
| Trigger | Output |
|---|---|
| help / bantuan / ? | Menu ini |

## QUICK COMMANDS
PT = Pertimbangan | PL = Putusan Lengkap
`;

const CORE_MD = "# CORE PROMPT REKAAN\nAnda asisten hukum rekaan untuk uji. " + "Kalimat pengisi core prompt. ".repeat(40);

function entriZip(ekstra: Array<{ nama: string; isi: string }> = [], awalan = "") {
  const dasar = [
    { nama: "ALETA_AI_PA_Edition_V4_5_Core_Prompt.md", isi: CORE_MD },
    { nama: "ALETA_05_Trigger_Menu.md", isi: MENU_MD },
    { nama: "ALETA_04_Pre-Intake_Kalkulator.md", isi: "# ALETA_04 — PRE-INTAKE & KALKULATOR\nIsi modul kalkulator rekaan nafkah iddah." },
    { nama: "ALETA_08_Format_Putusan_Donggala.md", isi: "# ALETA_08 — FORMAT PUTUSAN\nIsi format putusan rekaan." },
    { nama: "ALETA_13_Persiapan_Sidang.md", isi: "# ALETA_13 — PERSIAPAN SIDANG\nIsi panduan sidang rekaan." },
    { nama: "Buku Rekaan.pdf", isi: "%PDF-rekaan" },
    { nama: "aleta/alat_rekaan.py", isi: "print('x')" },
    ...ekstra,
  ];
  return dasar.map((e) => ({ nama: `${awalan}${e.nama}`, isi: Buffer.from(e.isi, "utf8") }));
}

const zipRekaan = (ekstra: Array<{ nama: string; isi: string }> = [], awalan = "") => susunZip(entriZip(ekstra, awalan));

/** ZIP berpemampatan deflate (metode 8) buatan tangan, untuk menguji jalur pembaca yang sama dengan ZIP asli. */
function zipDeflate(berkas: Array<{ nama: string; isi: string }>): Buffer {
  const lokal: Buffer[] = [];
  const pusat: Buffer[] = [];
  let posisi = 0;
  for (const b of berkas) {
    const nama = Buffer.from(b.nama, "utf8");
    const mentah = Buffer.from(b.isi, "utf8");
    const mampat = deflateRawSync(mentah);
    const kepala = Buffer.alloc(30);
    kepala.writeUInt32LE(0x04034b50, 0);
    kepala.writeUInt16LE(20, 4);
    kepala.writeUInt16LE(0x800, 6);
    kepala.writeUInt16LE(8, 8);
    kepala.writeUInt32LE(crc32(mentah) >>> 0, 14);
    kepala.writeUInt32LE(mampat.length, 18);
    kepala.writeUInt32LE(mentah.length, 22);
    kepala.writeUInt16LE(nama.length, 26);
    const daftar = Buffer.alloc(46);
    daftar.writeUInt32LE(0x02014b50, 0);
    daftar.writeUInt16LE(20, 4);
    daftar.writeUInt16LE(20, 6);
    daftar.writeUInt16LE(0x800, 8);
    daftar.writeUInt16LE(8, 10);
    daftar.writeUInt32LE(crc32(mentah) >>> 0, 16);
    daftar.writeUInt32LE(mampat.length, 20);
    daftar.writeUInt32LE(mentah.length, 24);
    daftar.writeUInt16LE(nama.length, 28);
    daftar.writeUInt32LE(posisi, 42);
    lokal.push(kepala, nama, mampat);
    pusat.push(daftar, nama);
    posisi += 30 + nama.length + mampat.length;
  }
  const dir = Buffer.concat(pusat);
  const akhir = Buffer.alloc(22);
  akhir.writeUInt32LE(0x06054b50, 0);
  akhir.writeUInt16LE(berkas.length, 8);
  akhir.writeUInt16LE(berkas.length, 10);
  akhir.writeUInt32LE(dir.length, 12);
  akhir.writeUInt32LE(posisi, 16);
  return Buffer.concat([...lokal, dir, akhir]);
}

// ─── Klien Claude tiruan ─────────────────────────────────────────────────────

type Jawaban = {
  teks?: string[];
  berhenti?: HasilAi["berhenti"];
  penggunaan?: Partial<PenggunaanToken>;
  galat?: GalatKlienAi;
  model?: string;
  iterasi?: HasilAi["iterasi"];
  /** Dipanggil sesudah potongan teks pertama; untuk menguji putus tengah jalan. */
  sesudahTeksPertama?: () => Promise<void>;
};

const NOL: PenggunaanToken = { masuk: 0, keluar: 0, cacheTulis: 0, cacheBaca: 0 };

class KlienTiruan implements KlienAi {
  panggilan: Array<import("@/lib/aleta-ai/penyusun").PermintaanAi> = [];
  klasifikasi: string | null = '{"kelompok":"cepat-bantuan","yakin":0.9}';
  jumlahKlasifikasi = 0;
  private antrean: Jawaban[];
  private terakhir: Jawaban = { teks: ["Jawaban rekaan."], penggunaan: { masuk: 1000, keluar: 500 } };
  hitung: number | null = 4000;

  constructor(antrean: Jawaban[] = []) {
    this.antrean = [...antrean];
  }

  async alirkan(p: import("@/lib/aleta-ai/penyusun").PermintaanAi, opsi: OpsiAlir = {}): Promise<HasilAi> {
    const klasifikasi = p.system[0]?.text.startsWith("Anda pengklasifikasi") ?? false;
    if (klasifikasi) {
      this.jumlahKlasifikasi += 1;
      this.panggilan.push(p);
      if (this.klasifikasi === null) throw new GalatKlienAi("lain", "gangguan");
      return { teks: this.klasifikasi, berhenti: "selesai", model: p.model, penggunaan: { ...NOL, masuk: 300, keluar: 40 }, iterasi: [], kategoriTolak: "", dialihkan: false };
    }
    this.panggilan.push(p);
    const j = this.antrean.shift() ?? this.terakhir;
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
    return {
      teks,
      berhenti: j.berhenti ?? "selesai",
      model: j.model ?? p.model,
      penggunaan: { ...NOL, ...(j.penggunaan ?? { masuk: 1000, keluar: 500 }) },
      iterasi: j.iterasi ?? [],
      kategoriTolak: j.berhenti === "ditolak" ? "general_harms" : "",
      dialihkan: false,
    };
  }

  async hitungToken(): Promise<number> {
    if (this.hitung === null) throw new Error("tidak tersedia");
    return this.hitung;
  }

  /** Permintaan jawaban (bukan pengklasifikasi). */
  get jawabanKe() {
    return this.panggilan.filter((p) => !p.system[0]?.text.startsWith("Anda pengklasifikasi"));
  }
}

async function kumpulkan(g: AsyncGenerator<EventAi, void, void>): Promise<EventAi[]> {
  const hasil: EventAi[] = [];
  for await (const e of g) hasil.push(e);
  return hasil;
}

const jenisUrut = (e: EventAi[]) => e.map((x) => x.jenis);

// ─── 1. Migrasi ──────────────────────────────────────────────────────────────

describe("migrasi 0078 - berkas = DDL schema.ts, jurnal tanpa lubang, ikut cadangan", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0078_aleta_ai.sql");

  it("jurnal: 0078 di idx 71 sekali (sesudah 0077), tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0078_"))).toEqual([expect.objectContaining({ idx: 71, tag: "0078_aleta_ai" })]);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i]?.when).toBeGreaterThan(j.entries[i - 1]?.when ?? 0);
    expect(existsSync(SQL)).toBe(true);
  });

  it("pernyataan berkas = DDL_ALETA_AI, berjalan di pg-mem, kesebelas tabel ikut cadangan", () => {
    expect(pernyataan(readFileSync(SQL, "utf8"))).toEqual([...DDL_ALETA_AI.tabel, ...DDL_ALETA_AI.indeks].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(readFileSync(SQL, "utf8"));
    expect(DDL_ALETA_AI.tabel).toHaveLength(11);
    for (const t of ["aleta_ai_proyek", "aleta_ai_obrolan", "aleta_ai_obrolan_pesan", "aleta_ai_penggunaan", "aleta_ai_saldo", "aleta_ai_mutasi", "aleta_ai_harga", "aleta_ai_kurs", "aleta_ai_pengaturan", "aleta_ai_rute", "aleta_ai_jejak"]) {
      expect(kosong.public.many(`SELECT * FROM ${t}`)).toEqual([]);
      expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
    }
  });
});

// ─── 2. Biaya ────────────────────────────────────────────────────────────────

describe("biaya: tarif, kurs + penyangga, margin, pembulatan, minimum", () => {
  const tarif = (m: string) => TARIF_BAWAAN.find((t) => t.model === m) as Tarif;

  it("tarif Opus 5.5 / Sonnet 5.5 sesuai rujukan ($4/$20, $2/$10, cache baca $0,20)", () => {
    const p: PenggunaanToken = { masuk: 1000, keluar: 2000, cacheTulis: 3000, cacheBaca: 4000 };
    // Opus: 1000*4 + 2000*20 + 3000*5 + 4000*0.2 = 59.800 per juta
    expect(biayaUsd(tarif(MODEL_OPUS), p)).toBeCloseTo(0.0598, 8);
    // Sonnet: 1000*2 + 2000*10 + 3000*2.5 + 4000*0.2 = 30.300 per juta
    expect(biayaUsd(tarif(MODEL_SONNET), p)).toBeCloseTo(0.0303, 8);
  });

  it("Haiku 5.5: dua kartu tarif menurut panjang prompt (<=100K dan di atasnya)", () => {
    const kecil: PenggunaanToken = { masuk: 50_000, keluar: 1000, cacheTulis: 0, cacheBaca: 0 };
    expect(biayaUsd(tarif(MODEL_HAIKU), kecil)).toBeCloseTo((50_000 * 0.1 + 1000 * 0.5) / 1e6, 10);
    const besar: PenggunaanToken = { masuk: 60_000, keluar: 1000, cacheTulis: 0, cacheBaca: 50_000 };
    // prompt 110K > 100K -> kartu "atas": $0,50 masuk, $2,50 keluar, cache baca $0,05
    expect(biayaUsd(tarif(MODEL_HAIKU), besar)).toBeCloseTo((60_000 * 0.5 + 1000 * 2.5 + 50_000 * 0.05) / 1e6, 10);
  });

  it("kurs efektif = kurs x (1 + penyangga); harga = USD x kurs efektif x (1 + margin), naik ke kelipatan Rp500", () => {
    expect(kursEfektif(16000, 3)).toBeCloseTo(16480, 6);
    const param = { marginPersen: 30, penyanggaKursPersen: 3, minimumRp: 1000, pembulatanRp: 500 };
    const h = hitungHarga(0.118, 16000, param);
    expect(h.kurs).toBeCloseTo(16480, 6);
    expect(h.biayaApiRp).toBeCloseTo(0.118 * 16000, 6);
    // 0,118 x 16.480 x 1,3 = 2.528,2 -> Rp3.000
    expect(h.hargaRp).toBe(3000);
    expect(h.tagihRp).toBe(3000);
  });

  it("minimum Rp1.000; tepat di kelipatan tidak naik; sedikit di atas naik; nol token = Rp0", () => {
    const polos = { marginPersen: 0, penyanggaKursPersen: 0, minimumRp: 1000, pembulatanRp: 500 };
    expect(hitungHarga(0.0001, 16000, polos).tagihRp).toBe(1000); // 1,6 -> minimum
    expect(hitungHarga(0.1, 10000, polos).tagihRp).toBe(1000); // tepat 1.000
    expect(hitungHarga(0.15, 10000, polos).tagihRp).toBe(1500); // tepat 1.500
    expect(hitungHarga(0.1500001, 10000, polos).tagihRp).toBe(2000); // sedikit di atas 1.500
    expect(hitungHarga(0, 10000, polos).tagihRp).toBe(0);
    expect(bulatkanKeAtas(1001, 500)).toBe(1500);
    expect(bulatkanKeAtas(0, 500)).toBe(0);
  });

  it("Super Admin gratis: tagih Rp0 tetapi biaya asli dan harga menurut rumus tetap dihitung", () => {
    const param = { marginPersen: 30, penyanggaKursPersen: 3, minimumRp: 1000, pembulatanRp: 500 };
    const h = hitungHarga(0.118, 16000, param, { gratis: true });
    expect(h.tagihRp).toBe(0);
    expect(h.hargaRp).toBe(3000);
    expect(h.biayaApiRp).toBeGreaterThan(0);
  });

  it("fallback server-side: tiap iterasi memakai tarif modelnya sendiri; model tak dikenal memakai tarif yang diminta", () => {
    const peta = new Map(TARIF_BAWAAN.map((t) => [t.model, t]));
    const usd = biayaUsdBanyak(peta, MODEL_OPUS, [
      { model: MODEL_OPUS, masuk: 1000, keluar: 100, cacheTulis: 0, cacheBaca: 0 },
      { model: "model-fallback-asing", masuk: 1000, keluar: 100, cacheTulis: 0, cacheBaca: 0 },
    ]);
    expect(usd).toBeCloseTo(2 * ((1000 * 4 + 100 * 20) / 1e6), 10);
    expect(iterasiDariUsage({ iterations: [{ type: "message", model: MODEL_OPUS, input_tokens: 5, output_tokens: 0 }, { type: "fallback_message", model: MODEL_SONNET, input_tokens: 5, output_tokens: 9 }] }, MODEL_OPUS)).toEqual([
      { model: MODEL_SONNET, masuk: 5, keluar: 9, cacheTulis: 0, cacheBaca: 0 },
    ]);
  });

  it("perkiraan tanpa count_tokens = karakter/4", () => {
    expect(perkirakanTokenDariKarakter(4000)).toBe(1000);
    expect(perkirakanTokenDariKarakter(0)).toBe(0);
  });
});

// ─── 3. Rute model ───────────────────────────────────────────────────────────

describe("rute model otomatis dan batas peran", () => {
  const tabel = tabelRuteDari(RUTE_BAWAAN);

  it("tabel bawaan mengikuti rencana bagian 2 (model, effort, label)", () => {
    const r = (k: string) => tabel.get(k);
    expect(r("cepat-bantuan")).toMatchObject({ model: MODEL_HAIKU, effort: "low", label: "Cepat" });
    expect(r("cepat-hitung")).toMatchObject({ model: MODEL_SONNET, effort: "low", label: "Cepat" });
    expect(r("teliti-ringkas")).toMatchObject({ model: MODEL_SONNET, effort: "medium", label: "Teliti" });
    expect(r("teliti-sidang")).toMatchObject({ model: MODEL_SONNET, effort: "high", label: "Teliti" });
    expect(r("mendalam-analisa")).toMatchObject({ model: MODEL_OPUS, effort: "high", label: "Mendalam" });
    expect(r("mendalam-putusan")).toMatchObject({ model: MODEL_OPUS, effort: "high", label: "Mendalam" });
    expect(r("mendalam-rumit")).toMatchObject({ model: MODEL_OPUS, effort: "max", label: "Mendalam" });
  });

  it("kata kunci memilih kelompok (dipakai tanpa kunci atau bila pengklasifikasi gagal)", () => {
    const k = (t: string) => klasifikasiKataKunci(t).kelompok;
    expect(k("tolong buatkan putusan lengkap cerai gugat")).toBe("mendalam-putusan");
    expect(k("bagaimana pembagian waris dan harta bersama ini")).toBe("mendalam-rumit");
    expect(k("buat duduk perkara dari gugatan ini")).toBe("mendalam-analisa");
    expect(k("siapkan panduan sidang pembuktian")).toBe("teliti-sidang");
    expect(k("ringkas keterangan saksi ini")).toBe("teliti-ringkas");
    expect(k("hitung nafkah iddah")).toBe("cepat-hitung");
    expect(k("apa itu verstek?")).toBe("cepat-bantuan");
    expect(klasifikasiKataKunci("x ".repeat(100)).yakin).toBeLessThan(0.55);
  });

  it("batas peran: hakim boleh semua; PP diturunkan ke Teliti; draf putusan ditolak bagi non-hakim", () => {
    expect(pilihRute(tabel, "mendalam-putusan", "hakim")).toMatchObject({ ok: true, diturunkan: false });
    expect(pilihRute(tabel, "mendalam-putusan", "ketua")).toMatchObject({ ok: true });
    expect(pilihRute(tabel, "mendalam-putusan", "wakil-ketua")).toMatchObject({ ok: true });
    expect(pilihRute(tabel, "mendalam-putusan", "super-admin")).toMatchObject({ ok: true });
    const tolak = pilihRute(tabel, "mendalam-putusan", "panitera-pengganti");
    expect(tolak.ok).toBe(false);
    if (!tolak.ok) expect(tolak.alasan).toMatch(/hanya tersedia bagi hakim/);
    const turun = pilihRute(tabel, "mendalam-analisa", "panitera-pengganti");
    expect(turun).toMatchObject({ ok: true, diturunkan: true });
    if (turun.ok) expect(turun.rute.kelompok).toBe("teliti-sidang");
    const rumit = pilihRute(tabel, "mendalam-rumit", "jurusita");
    if (rumit.ok) expect(rumit.rute.label).toBe("Teliti");
    const biasa = pilihRute(tabel, "teliti-ringkas", "jurusita");
    expect(biasa).toMatchObject({ ok: true, diturunkan: false });
  });

  it("naik satu tingkat mengikuti rantai dan menghormati peran", () => {
    expect(naikSatuTingkat(tabel, "cepat-bantuan", "hakim")?.kelompok).toBe("cepat-hitung");
    expect(naikSatuTingkat(tabel, "teliti-sidang", "hakim")?.kelompok).toBe("mendalam-analisa");
    expect(naikSatuTingkat(tabel, "teliti-sidang", "panitera-pengganti")).toBeNull();
    expect(naikSatuTingkat(tabel, "mendalam-rumit", "hakim")).toBeNull();
  });

  it("keluaran pengklasifikasi ditafsirkan toleran dan hanya menerima kelompok yang sah", () => {
    const sah = new Set(tabel.keys());
    expect(tafsirKeluaranPengklasifikasi('```json\n{"kelompok":"teliti-sidang","yakin":0.8}\n```', sah)).toMatchObject({ kelompok: "teliti-sidang", yakin: 0.8, sumber: "pengklasifikasi" });
    expect(tafsirKeluaranPengklasifikasi('{"kelompok":"ngawur","yakin":1}', sah)).toBeNull();
    expect(tafsirKeluaranPengklasifikasi("bukan json", sah)).toBeNull();
    expect(tafsirKeluaranPengklasifikasi('{"kelompok":"cepat-bantuan"}', sah)?.yakin).toBe(0.5);
  });
});

// ─── 4. Menu pemicu dan pemilihan modul ──────────────────────────────────────

describe("pemicu menu V4.5 dan pemilihan modul", () => {
  const menu = bacaMenuPemicu(MENU_MD);
  const olehKode = (k: string) => menu.find((p) => p.kode === k);

  it("membaca tabel ALETA_05: pemicu, alias, kelompok menu, modul yang disebut, dan kelompok rute", () => {
    expect(olehKode("duduk-perkara")).toMatchObject({ label: "Duduk Perkara", grup: "Drafting Utama", grupHuruf: "A", kelompok: "mendalam-analisa" });
    expect(olehKode("pertimbangan")?.alias).toEqual(["Pertimbangan", "PT"]);
    expect(olehKode("pertimbangan")?.kelompok).toBe("mendalam-putusan");
    expect(olehKode("putusan-lengkap")).toMatchObject({ kelompok: "mendalam-putusan", modul: ["ALETA_08"] });
    expect(olehKode("sidang")).toMatchObject({ kelompok: "teliti-sidang", modul: ["ALETA_13"], alias: ["SIDANG [agenda]", "PANDUAN SIDANG", "persiapan sidang"] });
    expect(olehKode("kalkulator-nafkah")).toMatchObject({ kelompok: "cepat-hitung", modul: ["ALETA_04"] });
    expect(olehKode("help")).toMatchObject({ kelompok: "cepat-bantuan", grup: "Utilitas" });
    expect(olehKode("debat")?.kelompok).toBe("mendalam-putusan"); // ditambah kode, bukan baris tabel
    expect(menu.some((p) => p.grup === "")).toBe(false); // QUICK COMMANDS tidak dibaca sebagai pemicu
  });

  it("teks yang DIAWALI alias dikenali sebagai pemicu (alias terpanjang menang)", () => {
    expect(cariPemicuDiAwalTeks(menu, "PT keuangan rumah tangga")?.kode).toBe("pertimbangan");
    expect(cariPemicuDiAwalTeks(menu, "panduan sidang 532/Pdt.G/2026")?.kode).toBe("sidang");
    expect(cariPemicuDiAwalTeks(menu, "KN untuk perkara ini")?.kode).toBe("kalkulator-nafkah");
    expect(cariPemicuDiAwalTeks(menu, "tolong PT keuangan")).toBeNull();
  });

  it("pemicu modul dari baris menu; modul tanpa baris memakai kata kunci judul; pemilihan menurut pemicu, kata kunci, dan bawaan", () => {
    const mentah = [
      { kode: "ALETA_04", judul: "PRE-INTAKE & KALKULATOR", isi: "x".repeat(100) },
      { kode: "ALETA_13", judul: "PERSIAPAN SIDANG", isi: "y".repeat(100) },
      { kode: "ALETA_12", judul: "SUMBER HUKUM", isi: "z".repeat(100) },
    ];
    const modul: ModulProyek[] = isiPemicuModul(mentah, menu);
    expect(modul.find((m) => m.kode === "ALETA_13")?.pemicu).toEqual(expect.arrayContaining(["SIDANG", "PANDUAN SIDANG", "persiapan sidang"]));
    expect(modul.find((m) => m.kode === "ALETA_12")?.pemicu).toEqual(expect.arrayContaining(["sumber", "hukum"]));

    const dariPemicu = pilihModul({ modul, teks: "apa saja", pemicu: olehKode("sidang") ?? null, kelompok: "teliti-sidang", labelMode: "Teliti" });
    expect(dariPemicu.terpilih.map((m) => m.kode)).toEqual(["ALETA_13"]);
    const dariKataKunci = pilihModul({ modul, teks: "bagaimana kalkulator nafkah?", pemicu: null, kelompok: "cepat-hitung", labelMode: "Cepat" });
    expect(dariKataKunci.terpilih.map((m) => m.kode)).toEqual(["ALETA_04"]);
    const anggaranHabis = pilihModul({
      modul: [
        { kode: "ALETA_01", judul: "A", isi: "a".repeat(25_000), pemicu: [] },
        { kode: "ALETA_02", judul: "B", isi: "b".repeat(25_000), pemicu: [] },
      ],
      teks: "",
      pemicu: { ...(olehKode("sidang") as NonNullable<ReturnType<typeof olehKode>>), modul: ["ALETA_01", "ALETA_02"] },
      kelompok: "cepat-bantuan",
      labelMode: "Cepat",
    });
    // Anggaran Cepat 30.000 karakter: modul pertama utuh, yang kedua tak muat.
    expect(anggaranHabis.terpilih.map((m) => m.kode)).toEqual(["ALETA_01"]);
    expect(anggaranHabis.dilewati).toEqual(["ALETA_02"]);
  });
});

// ─── 5. Proyek: ZIP -> modul dan pemicu ──────────────────────────────────────

describe("proyek V4.5: unggah ZIP fixture rekaan", () => {
  it("core prompt, modul ALETA_NN, pemicu dari ALETA_05; berkas non-teks hanya dicatat sebagai lampiran", () => {
    const h = bacaProyekDariZip(zipRekaan());
    expect(h.corePrompt).toContain("CORE PROMPT REKAAN");
    expect(h.modul.map((m) => m.kode)).toEqual(["ALETA_04", "ALETA_05", "ALETA_08", "ALETA_13"]);
    expect(h.modul.find((m) => m.kode === "ALETA_13")).toMatchObject({ judul: "PERSIAPAN SIDANG", pemicu: expect.arrayContaining(["PANDUAN SIDANG"]) });
    expect(h.menu.length).toBeGreaterThanOrEqual(6);
    expect(h.lampiran.map((l) => l.nama).sort()).toEqual(["Buku Rekaan.pdf", "aleta/alat_rekaan.py"]);
    expect(h.lampiran.find((l) => l.nama === "Buku Rekaan.pdf")).toMatchObject({ jenis: "pdf" });
    expect(h.peringatan).toEqual([]);
  });

  it("ZIP bertingkat (folder induk) dan ZIP berpemampatan deflate terbaca sama", () => {
    const dalamFolder = bacaProyekDariZip(zipRekaan([], "ALETA_V4_5_Lengkap/"));
    expect(dalamFolder.modul).toHaveLength(4);
    expect(dalamFolder.lampiran.map((l) => l.nama).sort()).toEqual(["Buku Rekaan.pdf", "aleta/alat_rekaan.py"]);
    const mampat = bacaProyekDariZip(zipDeflate(entriZip().map((e) => ({ nama: e.nama, isi: e.isi.toString("utf8") }))));
    expect(mampat.modul.map((m) => m.kode)).toEqual(["ALETA_04", "ALETA_05", "ALETA_08", "ALETA_13"]);
    expect(mampat.corePrompt).toContain("CORE PROMPT REKAAN");
  });

  it("menu tak terbaca: pemicu modul = kata kunci judul, ada peringatan; tanpa core prompt = 400; bukan ZIP = 400", () => {
    const tanpaMenu = zipRekaan([{ nama: "ALETA_05_Trigger_Menu.md", isi: "# ALETA_05 — MENU\nTidak ada tabel di sini." }]);
    // Berkas dengan nama sama ditambahkan: yang terbesar dipakai (menu asli lebih besar) -> uji dengan ZIP tanpa menu sama sekali.
    const lagi = susunZip(entriZip().filter((e) => e.nama !== "ALETA_05_Trigger_Menu.md"));
    const h = bacaProyekDariZip(lagi);
    expect(h.menu).toEqual([]);
    expect(h.peringatan.join(" ")).toMatch(/Menu pemicu/);
    expect(h.modul.find((m) => m.kode === "ALETA_13")?.pemicu).toEqual(expect.arrayContaining(["persiapan", "sidang"]));
    expect(tanpaMenu.length).toBeGreaterThan(0);
    expect(() => bacaProyekDariZip(susunZip(entriZip().filter((e) => !/Core_Prompt/.test(e.nama))))).toThrowError(/Core Prompt/);
    expect(() => bacaProyekDariZip(Buffer.from("bukan zip sama sekali, hanya teks biasa"))).toThrowError(/ZIP/);
  });
});

// ─── 6. Penyusun permintaan ──────────────────────────────────────────────────

describe("penyusun permintaan", () => {
  const rute = RUTE_BAWAAN.find((r) => r.kelompok === "mendalam-analisa") as (typeof RUTE_BAWAAN)[number];
  const modul: ModulProyek[] = [
    { kode: "ALETA_11", judul: "ANALISA PUTUSAN", isi: "Isi analisa.", pemicu: [] },
    { kode: "ALETA_12", judul: "SUMBER HUKUM", isi: "Isi sumber.", pemicu: [] },
  ];

  it("system = [core ber-cache, modul ber-cache]; effort eksplisit; tidak ada thinking/temperature", () => {
    const p = susunPermintaan({ rute, corePrompt: CORE_MD, modul, riwayat: [], teksPengguna: "Halo", fallback: true });
    expect(p.system).toHaveLength(2);
    expect(p.system[0]?.cache_control).toEqual({ type: "ephemeral" });
    expect(p.system[1]?.cache_control).toEqual({ type: "ephemeral" });
    expect(p.system[0]?.text).toContain("CORE PROMPT REKAAN");
    expect(p.system[1]?.text).toContain("=== ALETA_11 — ANALISA PUTUSAN ===");
    expect(p).toMatchObject({ model: MODEL_OPUS, effort: "high", maxTokens: 48000, fallback: true });
    expect(Object.keys(p)).not.toContain("thinking");
    expect(Object.keys(p)).not.toContain("temperature");
    expect(p.messages).toEqual([{ role: "user", content: "Halo" }]);
  });

  it("awalan stabil: core prompt tidak memuat waktu atau id; tanpa modul hanya satu blok system", () => {
    const a = susunPermintaan({ rute, corePrompt: CORE_MD, modul, riwayat: [], teksPengguna: "satu", fallback: false });
    const b = susunPermintaan({ rute, corePrompt: CORE_MD, modul, riwayat: [{ peran: "pengguna", isi: "dulu" }, { peran: "ai", isi: "jawab" }], teksPengguna: "dua", fallback: false });
    expect(a.system).toEqual(b.system);
    expect(susunPermintaan({ rute, corePrompt: CORE_MD, modul: [], riwayat: [], teksPengguna: "x", fallback: false }).system).toHaveLength(1);
    expect(rakitBlokModul([])).toBe("");
  });

  it("riwayat: diawali pengguna, peran berurutan digabung, akhir riwayat ber-cache", () => {
    const r = susunRiwayat([
      { peran: "ai", isi: "sisa jawaban lama tanpa pertanyaan" },
      { peran: "pengguna", isi: "tanya 1" },
      { peran: "pengguna", isi: "tanya 1b" },
      { peran: "ai", isi: "jawab 1" },
      { peran: "ai", isi: "   " },
    ]);
    expect(r).toEqual([
      { role: "user", content: "tanya 1\n\ntanya 1b" },
      { role: "assistant", content: "jawab 1" },
    ]);
    const p = susunPermintaan({ rute, corePrompt: CORE_MD, modul: [], riwayat: [{ peran: "pengguna", isi: "q" }, { peran: "ai", isi: "a" }], teksPengguna: "q2", fallback: false });
    expect(p.messages[1]).toEqual({ role: "assistant", content: [{ type: "text", text: "a", cache_control: { type: "ephemeral" } }] });
    expect(p.messages[2]).toEqual({ role: "user", content: "q2" });
  });
});

// ─── 7-9. Bagian berbasis data ───────────────────────────────────────────────

describe("ALETA Ai server: saldo, mesin, hak, rute HTTP (pg-mem)", () => {
  let db: AletaDatabase;
  const hariIni = () => tanggalLokal();

  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: false });
    ctx.db = db;
    await simpanKurs(db, { tanggal: hariIni(), kurs: 16000, sumber: "uji" });
    await unggahProyek(db, superAdmin.id, { bita: zipRekaan(), namaBerkas: "proyek-rekaan.zip" });
  }, 180000);

  afterAll(async () => {
    suntikKlienAi(undefined);
    await db?.close();
  });

  afterEach(() => {
    ulangiBatasLaju();
  });

  const bekali = async (p: PelakuAi, rp = 100_000) => {
    if (rp > 0) await terapkanMutasi(db, { penggunaId: p.id, jenis: "isi", jumlahRp: rp, catatan: "uji" });
  };

  const mutasiJenis = async (id: string) => (await daftarMutasi(db, id, 100)).map((m) => `${m.jenis}:${m.jumlahRp}`).reverse();

  // ── Saldo ──
  it("saldo = jumlah mutasi; tahan, lepas, potong seimbang; idempoten per rujukan", async () => {
    const p: PelakuAi = { ...hakim, id: "usr-saldo-1" };
    await bekali(p, 10_000);
    expect(await saldoPengguna(db, p.id)).toBe(10_000);
    expect(await tahanDana(db, p.id, 4000, "giliran-1")).toBe(true);
    expect(await saldoPengguna(db, p.id)).toBe(6000);
    const s = await selesaikanTahanan(db, p.id, "giliran-1", 2500);
    expect(s).toMatchObject({ dipotongRp: 2500, tidakTertagihRp: 0, saldoSetelah: 7500, sudahDiproses: false });
    // Dipanggil lagi (mis. finally + jalur normal): tidak menggandakan apa pun.
    expect(await selesaikanTahanan(db, p.id, "giliran-1", 2500)).toMatchObject({ dipotongRp: 0, sudahDiproses: true, saldoSetelah: 7500 });
    expect(await verifikasiSaldo(db, p.id)).toEqual({ saldo: 7500, jumlahMutasi: 7500, seimbang: true });
    expect(await mutasiJenis(p.id)).toEqual(["isi:10000", "tahan:-4000", "lepas:4000", "potong:-2500"]);
  });

  it("saldo kurang menolak tahan tanpa mengubah apa pun; potong tidak melebihi saldo yang ada", async () => {
    const p: PelakuAi = { ...hakim, id: "usr-saldo-2" };
    await bekali(p, 3000);
    expect(await tahanDana(db, p.id, 5000, "g-x")).toBe(false);
    expect(await saldoPengguna(db, p.id)).toBe(3000);
    expect(await tahanDana(db, p.id, 3000, "g-y")).toBe(true);
    // Biaya aktual melampaui tahanan: dipotong sebatas saldo, selisih dilaporkan.
    expect(await selesaikanTahanan(db, p.id, "g-y", 4000)).toMatchObject({ dipotongRp: 3000, tidakTertagihRp: 1000, saldoSetelah: 0 });
    expect((await verifikasiSaldo(db, p.id)).seimbang).toBe(true);
    await expect(terapkanMutasi(db, { penggunaId: p.id, jenis: "koreksi", jumlahRp: 0 })).rejects.toMatchObject({ status: 400 });
  });

  it("isi saldo hanya untuk pengguna yang ada, dengan jumlah wajar, dan tercatat sebagai mutasi", async () => {
    const ada = async (id: string) => id === "usr-isi";
    expect((await isiSaldo(db, superAdmin.id, { penggunaId: "usr-isi", jumlahRp: 25_000, catatan: "awal" }, ada)).saldoRp).toBe(25_000);
    await expect(isiSaldo(db, superAdmin.id, { penggunaId: "tidak-ada", jumlahRp: 1000 }, ada)).rejects.toMatchObject({ status: 404 });
    await expect(isiSaldo(db, superAdmin.id, { penggunaId: "usr-isi", jumlahRp: -5 }, ada)).rejects.toMatchObject({ status: 400 });
    await expect(isiSaldo(db, superAdmin.id, { penggunaId: "usr-isi", jumlahRp: 1e12 }, ada)).rejects.toMatchObject({ status: 400 });
    expect(await mutasiJenis("usr-isi")).toEqual(["isi:25000"]);
  });

  // ── Pengaturan ──
  it("bawaan: margin 30%, penyangga kurs 3%, minimum Rp1.000, pembulatan Rp500; hanya nilai wajar diterima", async () => {
    const p = await bacaPengaturan(db);
    expect(p).toMatchObject({ aktif: true, marginPersen: 30, penyanggaKursPersen: 3, minimumRp: 1000, pembulatanRp: 500 });
    expect((await bacaTarif(db)).map((t) => t.model).sort()).toEqual([MODEL_HAIKU, MODEL_OPUS, MODEL_SONNET].sort());
    expect((await bacaRute(db)).map((r) => r.kelompok)).toEqual(RUTE_BAWAAN.map((r) => r.kelompok));
    await expect(simpanPengaturan(db, superAdmin.id, { marginPersen: 9999 })).rejects.toMatchObject({ status: 400 });
    await expect(simpanPengaturan(db, superAdmin.id, { pembulatanRp: 0 })).rejects.toMatchObject({ status: 400 });
    await expect(simpanRute(db, superAdmin.id, [{ ...RUTE_BAWAAN[0]!, model: "model-tanpa-tarif" }])).rejects.toMatchObject({ status: 400 });
    await expect(simpanRute(db, superAdmin.id, [{ ...RUTE_BAWAAN[0]!, kelompok: "kelompok-baru" }])).rejects.toMatchObject({ status: 400 });
    await expect(simpanRute(db, superAdmin.id, [{ ...RUTE_BAWAAN[0]!, effort: "ultra" as never }])).rejects.toMatchObject({ status: 400 });
    await expect(simpanTarif(db, superAdmin.id, [{ ...TARIF_BAWAAN[0]!, keluarPerJuta: -1 }])).rejects.toMatchObject({ status: 400 });
    const jejak = await db.queryAll<{ aksi: string }>(`SELECT aksi FROM aleta_ai_jejak WHERE aksi LIKE 'admin.%'`);
    expect(jejak.length).toBe(0); // yang ditolak tidak meninggalkan jejak perubahan
  });

  // ── Kurs ──
  it("kurs: diambil sekali sehari dari pengambil, disimpan dengan sumbernya; gagal -> kurs terakhir dipakai (basi)", async () => {
    const d = newDb();
    void d;
    const hariA = new Date("2026-12-01T03:00:00Z");
    const hariB = new Date("2026-12-02T03:00:00Z");
    let panggilan = 0;
    const pengambil = async () => {
      panggilan += 1;
      return { kurs: 16250.5, sumber: "uji.example" };
    };
    expect(await segarkanKursBilaPerlu(db, { pengambil, sekarang: hariA })).toBe("diambil");
    expect(await segarkanKursBilaPerlu(db, { pengambil, sekarang: hariA })).toBe("sudah-ada");
    expect(panggilan).toBe(1);
    expect(await kursBerlaku(db, hariA)).toMatchObject({ kurs: 16250.5, tanggal: "2026-12-01", sumber: "uji.example", basi: false });
    const gagal = async () => {
      throw new Error("jaringan putus");
    };
    expect(await segarkanKursBilaPerlu(db, { pengambil: gagal, sekarang: hariB })).toBe("gagal");
    expect(await kursBerlaku(db, hariB)).toMatchObject({ kurs: 16250.5, basi: true });
    // Kurs tak wajar ditolak, bukan disimpan.
    expect(await segarkanKursBilaPerlu(db, { pengambil: async () => ({ kurs: 3, sumber: "ngawur" }), sekarang: hariB })).toBe("gagal");
    // Pulihkan kurs uji untuk bagian berikutnya (tanggal hari ini paling baru tetap menang bila lebih baru).
    await db.run(`DELETE FROM aleta_ai_kurs WHERE tanggal IN ('2026-12-01')`);
    expect((await kursBerlaku(db)).kurs).toBe(16000);
  });

  // ── Mesin ──
  async function siapkan(p: PelakuAi, klien: KlienTiruan, saldo = 100_000) {
    suntikKlienAi(klien);
    await bekali(p, saldo);
    return (await buatPercakapan(db, p.id)).id;
  }

  it("TANPA KUNCI -> nonaktif: ringkas menyatakan belum diaktifkan, kirim pesan menjawab gagal", async () => {
    suntikKlienAi(null);
    const id = (await buatPercakapan(db, hakim.id)).id;
    const r = await ringkasAi(db, hakim);
    expect(r).toMatchObject({ aktif: false, alasanNonaktif: PESAN_NONAKTIF_KUNCI, proyekVersi: 1 });
    expect(await kumpulkan(kirimPesan(db, hakim, id, { teks: "halo" }))).toEqual([{ jenis: "gagal", pesan: "ALETA Ai belum diaktifkan." }]);
  });

  it("SSE normal: perkiraan -> teks -> selesai; biaya = usage x tarif x kurs; saldo bersih; isi terenkripsi", async () => {
    const p: PelakuAi = { ...hakim, id: "usr-sse-1" };
    const klien = new KlienTiruan([{ teks: ["Bahwa ", "penggugat ", "mengajukan gugatan."], penggunaan: { masuk: 2000, keluar: 3000, cacheTulis: 10_000 } }]);
    const id = await siapkan(p, klien);
    const e = await kumpulkan(kirimPesan(db, p, id, { teks: "Duduk Perkara dari gugatan rekaan nomor 1/Pdt.G/2026" }));
    expect(jenisUrut(e)).toEqual(["perkiraan", "teks", "teks", "teks", "selesai"]);
    const perk = e[0] as Extract<EventAi, { jenis: "perkiraan" }>;
    const selesai = e[4] as Extract<EventAi, { jenis: "selesai" }>;
    expect(perk).toMatchObject({ mode: "Mendalam", label: "Mendalam" });
    expect(perk.perkiraanRp).toBeGreaterThanOrEqual(1000);
    expect(perk.perkiraanRp % 500).toBe(0);
    // Opus: 2000*4 + 3000*20 + 10000*5 = 118.000 per juta = $0,118 x 16.480 x 1,3 = Rp2.528,2 -> Rp3.000
    expect(selesai).toMatchObject({ mode: "Mendalam", label: "Mendalam", biayaRp: 3000, saldoRp: 97_000 });
    expect(e.filter((x) => x.jenis === "teks").map((x) => (x as { delta: string }).delta).join("")).toBe("Bahwa penggugat mengajukan gugatan.");

    expect(await saldoPengguna(db, p.id)).toBe(97_000);
    expect((await verifikasiSaldo(db, p.id)).seimbang).toBe(true);
    const jenis = await mutasiJenis(p.id);
    expect(jenis[0]).toBe("isi:100000");
    expect(jenis[1]).toMatch(/^tahan:-\d+$/);
    expect(jenis).toContain("potong:-3000");
    expect(jenis.find((j) => j.startsWith("lepas:"))).toBe(`lepas:${-Number(jenis[1]?.split(":")[1])}`);

    const baris = await db.queryOne<Record<string, unknown>>(`SELECT * FROM aleta_ai_obrolan_pesan WHERE id = ?`, [selesai.pesanId]);
    expect(baris).toMatchObject({ status: "selesai", model: MODEL_OPUS, effort: "high", mode_label: "Mendalam", kelompok: "mendalam-analisa", token_masuk: 2000, token_keluar: 3000, token_cache_tulis: 10_000, token_cache_baca: 0, biaya_rp: 3000, gratis: 0 });
    expect(Number(baris?.biaya_usd)).toBeCloseTo(0.118, 8);
    expect(Number(baris?.kurs_dasar)).toBe(16000);
    expect(Number(baris?.kurs)).toBeCloseTo(16480, 6);
    expect(Number(baris?.biaya_api_rp)).toBeCloseTo(0.118 * 16000, 4);
    // Isi tersimpan terenkripsi, bukan teks asli.
    expect(String(baris?.isi)).toMatch(/^enc:v1:/);
    expect(String(baris?.isi)).not.toContain("penggugat");
    const semuaIsi = await db.queryAll<{ isi: string; judul: string }>(`SELECT p.isi AS isi, c.judul AS judul FROM aleta_ai_obrolan_pesan p JOIN aleta_ai_obrolan c ON c.id = p.percakapan_id WHERE p.percakapan_id = ?`, [id]);
    for (const b of semuaIsi) {
      expect(b.isi).toMatch(/^enc:v1:/);
      expect(b.judul).toMatch(/^enc:v1:/);
    }

    // Permintaan yang dikirim: rute, system ber-cache, tanpa thinking, fallback hanya Opus/Sonnet.
    const q = klien.jawabanKe[0]!;
    expect(q).toMatchObject({ model: MODEL_OPUS, effort: "high", fallback: true });
    expect(q.system.every((b) => b.cache_control?.type === "ephemeral")).toBe(true);
    expect(JSON.stringify(q)).not.toContain("thinking");

    // Percakapan: pesan pengguna + AI, judul otomatis dari pertanyaan pertama.
    const tampil = await ambilPercakapan(db, p.id, id);
    expect(tampil.judul).toMatch(/^Duduk Perkara dari gugatan rekaan/);
    expect(tampil.pesan.map((m) => m.peran)).toEqual(["pengguna", "ai"]);
    expect(tampil.pesan[1]).toMatchObject({ isi: "Bahwa penggugat mengajukan gugatan.", mode: "Mendalam", biayaRp: 3000 });
    expect((await daftarPercakapan(db, p.id))[0]).toMatchObject({ id, judul: tampil.judul });

    // Pemakaian per panggilan dan jejak (tanpa isi pesan).
    const pakai = await db.queryAll<{ jenis: string; model: string }>(`SELECT jenis, model FROM aleta_ai_penggunaan WHERE pesan_id = ?`, [selesai.pesanId]);
    expect(pakai).toEqual([{ jenis: "jawaban", model: MODEL_OPUS }]);
    const jejak = await db.queryAll<{ ringkas: string; aksi: string }>(`SELECT aksi, ringkas FROM aleta_ai_jejak WHERE pesan_id = ?`, [selesai.pesanId]);
    expect(jejak[0]?.aksi).toBe("pesan");
    expect(jejak[0]?.ringkas).not.toContain("penggugat");
  });

  it("teks bebas: pengklasifikasi Haiku memilih kelompok; yakin rendah -> naik satu tingkat; biaya pengklasifikasi ikut", async () => {
    const p: PelakuAi = { ...hakim, id: "usr-klas-1" };
    const klien = new KlienTiruan();
    klien.klasifikasi = '{"kelompok":"teliti-sidang","yakin":0.9}';
    const id = await siapkan(p, klien);
    await kumpulkan(kirimPesan(db, p, id, { teks: "Bagaimana saya menyiapkan pembuktian minggu depan?" }));
    expect(klien.jumlahKlasifikasi).toBe(1);
    expect(klien.panggilan[0]).toMatchObject({ model: MODEL_HAIKU, effort: "low", fallback: false });
    expect(klien.jawabanKe[0]).toMatchObject({ model: MODEL_SONNET, effort: "high" });

    klien.klasifikasi = '{"kelompok":"teliti-ringkas","yakin":0.3}';
    await kumpulkan(kirimPesan(db, p, id, { teks: "sesuatu yang agak kabur" }));
    // Ragu -> satu tingkat di atas teliti-ringkas = teliti-sidang
    expect(klien.jawabanKe[1]).toMatchObject({ model: MODEL_SONNET, effort: "high" });

    const rows = await db.queryAll<{ jenis: string; model: string }>(`SELECT jenis, model FROM aleta_ai_penggunaan WHERE pengguna_id = ? ORDER BY jenis`, [p.id]);
    expect(rows.filter((r) => r.jenis === "klasifikasi")).toHaveLength(2);
    expect(rows.filter((r) => r.jenis === "klasifikasi").every((r) => r.model === MODEL_HAIKU)).toBe(true);
    expect((await verifikasiSaldo(db, p.id)).seimbang).toBe(true);
  });

  it("pengklasifikasi gagal -> aturan kata kunci; pemicu tombol dan awal teks memilih langsung tanpa pengklasifikasi", async () => {
    const p: PelakuAi = { ...hakim, id: "usr-klas-2" };
    const klien = new KlienTiruan();
    klien.klasifikasi = null; // pengklasifikasi mati
    const id = await siapkan(p, klien);
    await kumpulkan(kirimPesan(db, p, id, { teks: "hitung nafkah iddah untuk perkara ini" }));
    expect(klien.jawabanKe[0]).toMatchObject({ model: MODEL_SONNET, effort: "low" });

    const klien2 = new KlienTiruan();
    suntikKlienAi(klien2);
    await kumpulkan(kirimPesan(db, p, id, { teks: "", pemicu: "sidang" }));
    await kumpulkan(kirimPesan(db, p, id, { teks: "KN nafkah anak" }));
    expect(klien2.jumlahKlasifikasi).toBe(0);
    expect(klien2.jawabanKe[0]).toMatchObject({ model: MODEL_SONNET, effort: "high" }); // sidang -> teliti-sidang
    expect(klien2.jawabanKe[1]).toMatchObject({ model: MODEL_SONNET, effort: "low" }); // KN -> cepat-hitung
    // Tombol tanpa teks: label pemicu menjadi pertanyaan.
    const m = klien2.jawabanKe[0]!.messages.at(-1);
    expect(m).toEqual({ role: "user", content: "SIDANG" });
    // Modul ALETA_13 yang disebut baris menu ikut dikirim.
    expect(klien2.jawabanKe[0]!.system[1]?.text).toContain("ALETA_13");
  });

  it("Super Admin gratis: ditagih Rp0, tanpa mutasi, biaya asli tetap tercatat", async () => {
    const klien = new KlienTiruan([{ teks: ["ok"], penggunaan: { masuk: 2000, keluar: 3000, cacheTulis: 10_000 } }]);
    suntikKlienAi(klien);
    const id = (await buatPercakapan(db, superAdmin.id)).id;
    const e = await kumpulkan(kirimPesan(db, superAdmin, id, { teks: "", pemicu: "duduk-perkara" }));
    expect(e.at(-1)).toMatchObject({ jenis: "selesai", biayaRp: 0 });
    expect((e[0] as { perkiraanRp: number }).perkiraanRp).toBe(0);
    const baris = await db.queryOne<Record<string, unknown>>(`SELECT * FROM aleta_ai_obrolan_pesan WHERE percakapan_id = ? AND peran = 'ai'`, [id]);
    expect(baris).toMatchObject({ biaya_rp: 0, gratis: 1 });
    expect(Number(baris?.biaya_usd)).toBeCloseTo(0.118, 8);
    expect(Number(baris?.biaya_api_rp)).toBeGreaterThan(0);
    const mutasi = await db.queryAll<{ jenis: string; jumlah_rp: number }>(`SELECT jenis, jumlah_rp FROM aleta_ai_mutasi WHERE pengguna_id = ? AND jumlah_rp <> 0`, [superAdmin.id]);
    expect(mutasi.filter((m) => ["tahan", "potong"].includes(m.jenis))).toEqual([]);
  });

  it("saldo kurang: giliran ditolak dengan kalimat biasa, tidak ada panggilan dan tidak ada mutasi", async () => {
    const p: PelakuAi = { ...hakim, id: "usr-miskin" };
    const klien = new KlienTiruan();
    const id = await siapkan(p, klien, 0);
    const e1 = await kumpulkan(kirimPesan(db, p, id, { teks: "Duduk Perkara tolong" }));
    expect(e1).toHaveLength(1);
    expect(e1[0]).toMatchObject({ jenis: "gagal" });
    expect((e1[0] as { pesan: string }).pesan).toMatch(/Saldo ALETA Ai Anda \(Rp0\) tidak cukup/);
    // Saldo ada tetapi di bawah perkiraan giliran Mendalam.
    await bekali(p, 1000);
    const e2 = await kumpulkan(kirimPesan(db, p, id, { teks: "", pemicu: "duduk-perkara" }));
    expect(e2[0]).toMatchObject({ jenis: "gagal" });
    expect((e2[0] as { pesan: string }).pesan).toMatch(/tidak cukup untuk giliran ini \(perkiraan Rp/);
    expect(klien.jawabanKe).toHaveLength(0);
    expect(await mutasiJenis(p.id)).toEqual(["isi:1000"]);
  });

  it("refusal sebelum keluaran: naik satu tingkat sekali (perkiraan baru), lalu menjawab; refusal di puncak = gagal tanpa potong", async () => {
    const p: PelakuAi = { ...hakim, id: "usr-tolak-1" };
    const klien = new KlienTiruan([
      { teks: [], berhenti: "ditolak", penggunaan: { masuk: 0, keluar: 0 } },
      { teks: ["Jawaban sesudah naik."], penggunaan: { masuk: 1000, keluar: 1000 } },
    ]);
    const id = await siapkan(p, klien);
    const e = await kumpulkan(kirimPesan(db, p, id, { teks: "", pemicu: "sidang" }));
    expect(jenisUrut(e)).toEqual(["perkiraan", "perkiraan", "teks", "selesai"]);
    expect(klien.jawabanKe.map((q) => q.model)).toEqual([MODEL_SONNET, MODEL_OPUS]); // teliti-sidang -> mendalam-analisa
    expect(e.at(-1)).toMatchObject({ jenis: "selesai", mode: "Mendalam" });
    expect((await verifikasiSaldo(db, p.id)).seimbang).toBe(true);

    const q: PelakuAi = { ...hakim, id: "usr-tolak-2" };
    const puncak = new KlienTiruan([{ teks: [], berhenti: "ditolak", penggunaan: { masuk: 0, keluar: 0 } }]);
    puncak.klasifikasi = '{"kelompok":"mendalam-rumit","yakin":0.9}';
    const id2 = await siapkan(q, puncak);
    const e2 = await kumpulkan(kirimPesan(db, q, id2, { teks: "Perkara waris dan harta bersama yang rumit" }));
    expect(e2.at(-1)).toEqual({ jenis: "gagal", pesan: PESAN_DITOLAK });
    expect(await saldoPengguna(db, q.id)).toBe(100_000); // tidak dipotong
    expect((await verifikasiSaldo(db, q.id)).seimbang).toBe(true);
  });

  it("refusal di tengah keluaran: teks sementara disimpan, catatan penolakan ditambahkan, biaya sesuai pemakaian", async () => {
    const p: PelakuAi = { ...hakim, id: "usr-tolak-3" };
    const klien = new KlienTiruan([{ teks: ["Awal jawaban "], berhenti: "ditolak", penggunaan: { masuk: 1000, keluar: 200 } }]);
    const id = await siapkan(p, klien);
    const e = await kumpulkan(kirimPesan(db, p, id, { teks: "", pemicu: "sidang" }));
    expect(jenisUrut(e)).toEqual(["perkiraan", "teks", "teks", "selesai"]);
    expect((e[2] as { delta: string }).delta).toContain(PESAN_DITOLAK);
    const baris = await db.queryOne<{ status: string; biaya_rp: number }>(`SELECT status, biaya_rp FROM aleta_ai_obrolan_pesan WHERE percakapan_id = ? AND peran = 'ai'`, [id]);
    expect(baris?.status).toBe("ditolak");
    expect(Number(baris?.biaya_rp)).toBeGreaterThanOrEqual(1000);
    const tampil = await ambilPercakapan(db, p.id, id);
    expect(tampil.pesan.at(-1)?.isi).toContain("Awal jawaban");
  });

  it("batas token (max_tokens): jawaban diberi catatan terpotong dan status terpotong", async () => {
    const p: PelakuAi = { ...hakim, id: "usr-batas-1" };
    const klien = new KlienTiruan([{ teks: ["Jawaban panjang "], berhenti: "batas", penggunaan: { masuk: 500, keluar: 8000 } }]);
    const id = await siapkan(p, klien);
    const e = await kumpulkan(kirimPesan(db, p, id, { teks: "", pemicu: "sidang" }));
    expect(e.some((x) => x.jenis === "teks" && (x as { delta: string }).delta === CATATAN_TERPOTONG)).toBe(true);
    expect(e.at(-1)).toMatchObject({ jenis: "selesai" });
    const baris = await db.queryOne<{ status: string }>(`SELECT status FROM aleta_ai_obrolan_pesan WHERE percakapan_id = ? AND peran = 'ai'`, [id]);
    expect(baris?.status).toBe("terpotong");
  });

  it("galat layanan: kalimat biasa tanpa pesan SDK, giliran tidak dipotong, tahanan dikembalikan", async () => {
    const p: PelakuAi = { ...hakim, id: "usr-galat-1" };
    const klien = new KlienTiruan([{ galat: new GalatKlienAi("beban", "Layanan AI sedang terlalu padat. Coba lagi sebentar lagi.") }]);
    const id = await siapkan(p, klien);
    const e = await kumpulkan(kirimPesan(db, p, id, { teks: "", pemicu: "sidang" }));
    expect(jenisUrut(e)).toEqual(["perkiraan", "gagal"]);
    expect(e[1]).toEqual({ jenis: "gagal", pesan: "Layanan AI sedang terlalu padat. Coba lagi sebentar lagi." });
    expect(await saldoPengguna(db, p.id)).toBe(100_000);
    expect(await mutasiJenis(p.id)).toEqual(expect.arrayContaining(["isi:100000"]));
    const mutasi = await mutasiJenis(p.id);
    expect(mutasi.filter((m) => m.startsWith("potong"))).toEqual([]);
    expect((await verifikasiSaldo(db, p.id)).seimbang).toBe(true);
  });

  it("pelanggan memutus tengah jalan (generator di-return): panggilan dihentikan dan tahanan tetap dilepas", async () => {
    const p: PelakuAi = { ...hakim, id: "usr-putus-1" };
    const klien = new KlienTiruan([{ teks: ["a", "b", "c", "d"], penggunaan: { masuk: 1000, keluar: 100 } }]);
    const id = await siapkan(p, klien);
    const g = kirimPesan(db, p, id, { teks: "", pemicu: "sidang" });
    expect((await g.next()).value).toMatchObject({ jenis: "perkiraan" });
    expect((await g.next()).value).toMatchObject({ jenis: "teks" });
    await g.return(undefined);
    expect(await saldoPengguna(db, p.id)).toBe(100_000);
    expect((await verifikasiSaldo(db, p.id)).seimbang).toBe(true);
    const baris = await db.queryOne<{ status: string }>(`SELECT status FROM aleta_ai_obrolan_pesan WHERE percakapan_id = ? AND peran = 'ai'`, [id]);
    expect(baris?.status).toBe("gagal");
    const mutasi = await mutasiJenis(p.id);
    expect(mutasi.filter((m) => m.startsWith("tahan"))).toHaveLength(1);
    expect(mutasi.filter((m) => m.startsWith("lepas"))).toHaveLength(1);
  });

  it("batas peran di mesin: PP minta draf putusan ditolak; hakim yang sama diizinkan; pemicu putusan disembunyikan dari PP", async () => {
    const klien = new KlienTiruan();
    const idPp = await siapkan({ ...pp, id: "usr-pp-1" }, klien);
    const e = await kumpulkan(kirimPesan(db, { ...pp, id: "usr-pp-1" }, idPp, { teks: "", pemicu: "putusan-lengkap" }));
    expect(e).toHaveLength(1);
    expect((e[0] as { pesan: string }).pesan).toMatch(/hanya tersedia bagi hakim, ketua, dan wakil ketua/);
    expect(klien.jawabanKe).toHaveLength(0);

    const ringkasPp = await ringkasAi(db, { ...pp, id: "usr-pp-1" });
    const ringkasHakim = await ringkasAi(db, hakim);
    expect(ringkasPp.pemicu.some((x) => x.kode === "putusan-lengkap")).toBe(false);
    expect(ringkasHakim.pemicu.find((x) => x.kode === "putusan-lengkap")).toMatchObject({ label: "Putusan Lengkap", kelompok: "Drafting Utama", mode: "Mendalam" });
    expect(ringkasHakim.pemicu.find((x) => x.kode === "help")).toMatchObject({ mode: "Cepat" });

    // PP minta analisa mendalam lewat pemicu: diturunkan ke Teliti, bukan ditolak.
    const idPp2 = (await buatPercakapan(db, "usr-pp-1")).id;
    const e2 = await kumpulkan(kirimPesan(db, { ...pp, id: "usr-pp-1" }, idPp2, { teks: "", pemicu: "duduk-perkara" }));
    expect(e2[0]).toMatchObject({ jenis: "perkiraan", mode: "Teliti" });
    expect(klien.jawabanKe[0]).toMatchObject({ model: MODEL_SONNET, effort: "high" });
  });

  it("saklar darurat, proyek belum dipasang, batas laju, dan batas harian", async () => {
    const p: PelakuAi = { ...hakim, id: "usr-batas-2" };
    const klien = new KlienTiruan();
    const id = await siapkan(p, klien);

    await simpanPengaturan(db, superAdmin.id, { aktif: false });
    expect(await kumpulkan(kirimPesan(db, p, id, { teks: "halo" }))).toEqual([{ jenis: "gagal", pesan: PESAN_NONAKTIF_SAKLAR }]);
    expect(await ringkasAi(db, p)).toMatchObject({ aktif: false, alasanNonaktif: PESAN_NONAKTIF_SAKLAR });
    await simpanPengaturan(db, superAdmin.id, { aktif: true });

    // Batas laju: 6 per menit bawaan.
    await simpanPengaturan(db, superAdmin.id, { batasLajuPerMenit: 2 });
    const hasil: string[] = [];
    for (let i = 0; i < 3; i += 1) hasil.push((await kumpulkan(kirimPesan(db, p, id, { teks: "", pemicu: "help" }))).at(-1)?.jenis ?? "");
    expect(hasil).toEqual(["selesai", "selesai", "gagal"]);
    expect(izinkanLaju("orang-lain", 1, 1_000)).toBe(true);
    expect(izinkanLaju("orang-lain", 1, 1_500)).toBe(false);
    expect(izinkanLaju("orang-lain", 1, 62_000)).toBe(true);
    ulangiBatasLaju();
    await simpanPengaturan(db, superAdmin.id, { batasLajuPerMenit: 6 });

    // Batas harian Rp: setelah terpakai >= batas, giliran berikut ditolak.
    await simpanPengaturan(db, superAdmin.id, { batasHarianRp: 1000 });
    const e = await kumpulkan(kirimPesan(db, p, id, { teks: "", pemicu: "help" }));
    expect(e).toEqual([{ jenis: "gagal", pesan: "Batas pemakaian harian ALETA Ai Anda sudah tercapai. Coba lagi besok." }]);
    await simpanPengaturan(db, superAdmin.id, { batasHarianRp: 100_000 });

    // Proyek belum dipasang.
    await db.run(`UPDATE aleta_ai_proyek SET aktif = 0`);
    expect((await ringkasAi(db, p)).alasanNonaktif).toBe(PESAN_NONAKTIF_PROYEK);
    expect((await kumpulkan(kirimPesan(db, p, id, { teks: "halo" })))[0]).toEqual({ jenis: "gagal", pesan: PESAN_NONAKTIF_PROYEK });
    await db.run(`UPDATE aleta_ai_proyek SET aktif = 1 WHERE versi = (SELECT MAX(versi) FROM aleta_ai_proyek)`);
    expect((await proyekAktif(db))?.versi).toBe(1);
  });

  // ── Proyek berversi ──
  it("unggah: versi bertambah, hanya satu aktif; ZIP yang sama tidak membuat versi baru; ZIP salah ditolak", async () => {
    const sama = await unggahProyek(db, superAdmin.id, { bita: zipRekaan(), namaBerkas: "lagi.zip" });
    expect(sama.tidakBerubah).toBe(true);
    const baru = await unggahProyek(db, superAdmin.id, { bita: zipRekaan([{ nama: "ALETA_21_Indeks_SEMA.md", isi: "# ALETA_21 — INDEKS SEMA\nIsi indeks rekaan." }]), namaBerkas: "v2.zip" });
    expect(baru.tidakBerubah).toBe(false);
    expect(baru.proyek).toMatchObject({ versi: 2, aktif: true, jumlahModul: 5 });
    const aktif = await db.queryAll<{ versi: number }>(`SELECT versi FROM aleta_ai_proyek WHERE aktif = 1`);
    expect(aktif.map((a) => Number(a.versi))).toEqual([2]);
    expect((await proyekAktif(db))?.modul.map((m) => m.kode)).toContain("ALETA_21");
    await expect(unggahProyek(db, superAdmin.id, { bita: Buffer.from("bukan zip"), namaBerkas: "x.zip" })).rejects.toMatchObject({ status: 400 });
    await expect(unggahProyek(db, superAdmin.id, { bita: Buffer.alloc(0), namaBerkas: "x.zip" })).rejects.toMatchObject({ status: 400 });
    expect((await ringkasAi(db, hakim)).proyekVersi).toBe(2);
  });

  // ── Hak ──
  it("percakapan hanya milik pemilik: orang lain DAN Super Admin mendapat 404; sembunyikan bukan hapus", async () => {
    const id = (await buatPercakapan(db, hakim.id, { judul: "Musyawarah rahasia" })).id;
    await expect(ambilPercakapan(db, hakim2.id, id)).rejects.toMatchObject({ status: 404 });
    await expect(ambilPercakapan(db, superAdmin.id, id)).rejects.toMatchObject({ status: 404 });
    await expect(ubahJudul(db, superAdmin.id, id, "curian")).rejects.toMatchObject({ status: 404 });
    await expect(sembunyikanPercakapan(db, superAdmin.id, id)).rejects.toMatchObject({ status: 404 });
    expect((await daftarPercakapan(db, superAdmin.id)).some((c) => c.id === id)).toBe(false);
    expect(await kumpulkan(kirimPesan(db, superAdmin, id, { teks: "intip" }))).toEqual([{ jenis: "gagal", pesan: "Percakapan tidak ditemukan." }]);
    expect((await ubahJudul(db, hakim.id, id, "Judul baru")).judul).toBe("Judul baru");
    await sembunyikanPercakapan(db, hakim.id, id);
    expect((await daftarPercakapan(db, hakim.id)).some((c) => c.id === id)).toBe(false);
    const masihAda = await db.queryOne<{ tersembunyi: number }>(`SELECT tersembunyi FROM aleta_ai_obrolan WHERE id = ?`, [id]);
    expect(Number(masihAda?.tersembunyi)).toBe(1);
  });

  it("laporan Super Admin: pendapatan, biaya API, laba, per pengguna/peran/kelompok/model - tanpa satu pun isi percakapan", async () => {
    const lap = await laporanBulanan(db);
    expect(lap.ringkasan.giliran).toBeGreaterThan(5);
    expect(lap.ringkasan.pendapatanRp).toBeGreaterThan(0);
    expect(lap.ringkasan.biayaApiRp).toBeGreaterThan(0);
    expect(lap.ringkasan.labaRp).toBeCloseTo(lap.ringkasan.pendapatanRp - lap.ringkasan.biayaApiRp, 6);
    expect(lap.ringkasan.gratis).toBeGreaterThanOrEqual(1);
    expect(lap.perModel.map((m) => m.model)).toEqual(expect.arrayContaining([MODEL_OPUS, MODEL_SONNET]));
    expect(lap.perKelompok.length).toBeGreaterThan(1);
    expect(lap.perPengguna.length).toBeGreaterThan(3);
    const teksLaporan = JSON.stringify(lap);
    for (const rahasia of ["Bahwa penggugat", "Duduk Perkara dari gugatan", "Musyawarah rahasia", "Jawaban rekaan", "Judul baru"]) {
      expect(teksLaporan).not.toContain(rahasia);
    }
    await expect(laporanBulanan(db, "2026-13")).rejects.toMatchObject({ status: 400 });
    expect((await laporanBulanan(db, "2020-01")).ringkasan.giliran).toBe(0);
  });

  // ── Rute HTTP ──
  describe("rute HTTP: kontrak bentuk jawaban", () => {
    const req = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(`http://localhost${url}`, init);
    const json = async (r: Response) => (await r.json()) as { ok: boolean; data?: Record<string, unknown> & unknown[]; error?: { message: string } };

    it("GET ringkas dan saldo: {ok,data} sesuai kontrak", async () => {
      ctx.pelaku = { ...hakim, id: "usr-http-1" };
      suntikKlienAi(new KlienTiruan());
      await bekali(ctx.pelaku as PelakuAi, 5000);
      const { GET: ringkas } = await import("@/app/api/aleta-ai/ringkas/route");
      const r = await json(await ringkas(req("/api/aleta-ai/ringkas")));
      expect(r.ok).toBe(true);
      expect(r.data).toMatchObject({ aktif: true, saldoRp: 5000, superAdmin: false, proyekVersi: 2 });
      expect(Array.isArray(r.data?.pemicu)).toBe(true);
      expect((r.data?.pemicu as Array<Record<string, unknown>>)[0]).toEqual(expect.objectContaining({ kode: expect.any(String), label: expect.any(String), kelompok: expect.any(String) }));
      const { GET: saldo } = await import("@/app/api/aleta-ai/saldo/route");
      const s = await json(await saldo(req("/api/aleta-ai/saldo")));
      expect(s.data).toMatchObject({ saldoRp: 5000, mutasi: [expect.objectContaining({ jenis: "isi", jumlahRp: 5000 })] });
    });

    it("POST/GET/PATCH/DELETE percakapan; milik orang lain 404", async () => {
      ctx.pelaku = { ...hakim, id: "usr-http-2" };
      const { GET: daftar, POST: buat } = await import("@/app/api/aleta-ai/percakapan/route");
      const { GET: satu, PATCH: ganti, DELETE: sembunyi } = await import("@/app/api/aleta-ai/percakapan/[id]/route");
      const dibuat = await json(await buat(req("/api/aleta-ai/percakapan", { method: "POST", body: JSON.stringify({ judul: "Uji HTTP" }) })));
      const id = String(dibuat.data?.id);
      expect(id).toMatch(/^aic-/);
      expect(((await json(await daftar(req("/api/aleta-ai/percakapan")))).data as unknown as Array<{ id: string; judul: string }>)[0]).toMatchObject({ id, judul: "Uji HTTP" });
      const konteks = { params: Promise.resolve({ id }) };
      expect((await json(await satu(req(`/api/aleta-ai/percakapan/${id}`), konteks))).data).toMatchObject({ id, judul: "Uji HTTP", pesan: [] });
      expect((await json(await ganti(req(`/api/aleta-ai/percakapan/${id}`, { method: "PATCH", body: JSON.stringify({ judul: "Ganti" }) }), konteks))).data).toMatchObject({ judul: "Ganti" });
      ctx.pelaku = superAdmin;
      const intip = await satu(req(`/api/aleta-ai/percakapan/${id}`), konteks);
      expect(intip.status).toBe(404);
      ctx.pelaku = { ...hakim, id: "usr-http-2" };
      expect((await json(await sembunyi(req(`/api/aleta-ai/percakapan/${id}`, { method: "DELETE" }), konteks))).data).toMatchObject({ disembunyikan: true });
      expect((await satu(req(`/api/aleta-ai/percakapan/${id}`), konteks)).status).toBe(404);
    });

    it("POST pesan menjawab text/event-stream: satu `data: {json}` per peristiwa, urutan perkiraan -> teks -> selesai", async () => {
      const p: PelakuAi = { ...hakim, id: "usr-http-3" };
      ctx.pelaku = p;
      suntikKlienAi(new KlienTiruan([{ teks: ["Halo ", "dunia"], penggunaan: { masuk: 800, keluar: 100 } }]));
      await bekali(p);
      const id = (await buatPercakapan(db, p.id)).id;
      const { POST } = await import("@/app/api/aleta-ai/percakapan/[id]/pesan/route");
      const respons = await POST(req(`/api/aleta-ai/percakapan/${id}/pesan`, { method: "POST", body: JSON.stringify({ teks: "", pemicu: "help" }) }), { params: Promise.resolve({ id }) });
      expect(respons.status).toBe(200);
      expect(respons.headers.get("content-type")).toContain("text/event-stream");
      const mentah = await respons.text();
      const peristiwa = mentah.split("\n\n").filter((b) => b.startsWith("data: ")).map((b) => JSON.parse(b.slice(6)) as EventAi);
      expect(jenisUrut(peristiwa)).toEqual(["perkiraan", "teks", "teks", "selesai"]);
      expect(peristiwa[0]).toMatchObject({ mode: "Cepat", label: "Cepat" });
      expect(peristiwa.at(-1)).toMatchObject({ jenis: "selesai", pesanId: expect.stringMatching(/^aip-/), biayaRp: 1000, saldoRp: 99_000 });
      expect(mentah).not.toMatch(/sk-ant|ANTHROPIC/);
      // Percakapan milik orang lain: 404 JSON biasa, bukan aliran.
      ctx.pelaku = superAdmin;
      const intip = await POST(req(`/api/aleta-ai/percakapan/${id}/pesan`, { method: "POST", body: JSON.stringify({ teks: "intip" }) }), { params: Promise.resolve({ id }) });
      expect(intip.status).toBe(404);
      // aliranSse langsung: generator ditutup bila pelanggan membatalkan.
      let selesaiGenerator = false;
      async function* contoh(): AsyncGenerator<EventAi, void, void> {
        try {
          yield { jenis: "teks", delta: "a" };
          yield { jenis: "teks", delta: "b" };
        } finally {
          selesaiGenerator = true;
        }
      }
      const pembaca = aliranSse(contoh()).getReader();
      await pembaca.read();
      await pembaca.cancel();
      expect(selesaiGenerator).toBe(true);
    });

    it("rute admin: hanya Super Admin; pengaturan dapat diubah dan tidak pernah memuat kunci API", async () => {
      const { GET, PUT } = await import("@/app/api/aleta-ai/pengaturan/route");
      ctx.pelaku = hakim;
      expect((await GET(req("/api/aleta-ai/pengaturan"))).status).toBe(403);
      expect((await PUT(req("/api/aleta-ai/pengaturan", { method: "PUT", body: JSON.stringify({ pengaturan: { marginPersen: 99 } }) }))).status).toBe(403);
      ctx.pelaku = superAdmin;
      const sebelum = await json(await GET(req("/api/aleta-ai/pengaturan")));
      expect(sebelum.data).toMatchObject({ pengaturan: { marginPersen: 30, penyanggaKursPersen: 3 }, kunciTerpasang: false });
      expect((sebelum.data?.rute as unknown as unknown[]).length).toBe(7);
      process.env.ANTHROPIC_API_KEY = "sk-ant-kunci-rahasia-uji";
      try {
        const dengan = await GET(req("/api/aleta-ai/pengaturan"));
        const teksRespons = await dengan.text();
        expect(JSON.parse(teksRespons).data.kunciTerpasang).toBe(true);
        expect(teksRespons).not.toContain("sk-ant-kunci-rahasia-uji");
      } finally {
        delete process.env.ANTHROPIC_API_KEY;
      }
      const sesudah = await json(await PUT(req("/api/aleta-ai/pengaturan", { method: "PUT", body: JSON.stringify({ pengaturan: { marginPersen: 40 } }) })));
      expect(sesudah.data).toMatchObject({ pengaturan: { marginPersen: 40 } });
      await PUT(req("/api/aleta-ai/pengaturan", { method: "PUT", body: JSON.stringify({ pengaturan: { marginPersen: 30 } }) }));
      const salah = await PUT(req("/api/aleta-ai/pengaturan", { method: "PUT", body: JSON.stringify({ pengaturan: { marginPersen: -5 } }) }));
      expect(salah.status).toBe(400);

      const { GET: kurs } = await import("@/app/api/aleta-ai/kurs/route");
      expect((await json(await kurs(req("/api/aleta-ai/kurs")))).data).toMatchObject({ kurs: 16000, tersimpan: true, penyanggaKursPersen: 3 });
      ctx.pelaku = hakim;
      expect((await kurs(req("/api/aleta-ai/kurs"))).status).toBe(403);
      const { GET: lap } = await import("@/app/api/aleta-ai/laporan/route");
      expect((await lap(req("/api/aleta-ai/laporan"))).status).toBe(403);
      ctx.pelaku = superAdmin;
      expect((await json(await lap(req("/api/aleta-ai/laporan")))).data).toHaveProperty("ringkasan.labaRp");
    });

    it("rute admin: isi saldo dan unggah proyek (multipart) - Super Admin saja", async () => {
      const { POST: isi } = await import("@/app/api/aleta-ai/saldo/isi/route");
      const { GET: daftarProyek, POST: unggah } = await import("@/app/api/aleta-ai/proyek/route");
      ctx.pelaku = hakim;
      expect((await isi(req("/api/aleta-ai/saldo/isi", { method: "POST", body: JSON.stringify({ penggunaId: "x", jumlahRp: 1000 }) }))).status).toBe(403);
      expect((await daftarProyek(req("/api/aleta-ai/proyek"))).status).toBe(403);
      ctx.pelaku = superAdmin;
      // penggunaAda memeriksa tabel users: pengguna rekaan tidak ada -> 404 yang jelas
      expect((await isi(req("/api/aleta-ai/saldo/isi", { method: "POST", body: JSON.stringify({ penggunaId: "tidak-ada", jumlahRp: 1000 }) }))).status).toBe(404);

      const kosong = await unggah(req("/api/aleta-ai/proyek", { method: "POST", body: JSON.stringify({}), headers: { "content-type": "application/json" } }));
      expect(kosong.status).toBe(400);
      const form = new FormData();
      form.set("berkas", new File([new Uint8Array(zipRekaan([{ nama: "ALETA_09_Pemeriksa_BAS.md", isi: "# ALETA_09 — PEMERIKSA BAS\nIsi rekaan." }]))], "v3.zip", { type: "application/zip" }));
      const hasil = await json(await unggah(req("/api/aleta-ai/proyek", { method: "POST", body: form })));
      expect(hasil.ok).toBe(true);
      expect(hasil.data).toMatchObject({ tidakBerubah: false, proyek: { versi: 3, aktif: true } });
      const daftar = await json(await daftarProyek(req("/api/aleta-ai/proyek")));
      expect(daftar.data).toMatchObject({ versi: 3, aktif: { versi: 3 }, diperbarui: expect.any(String) });
      expect((daftar.data?.modul as unknown as Array<{ kode: string }>).map((m) => m.kode)).toContain("ALETA_09");
      expect((daftar.data?.riwayat as unknown as unknown[]).length).toBe(3);
    });

    it("bentuk jawaban disepakati dengan layar: margin/penyanggaKurs dalam PERSEN, proyek, laporan datar, kurs, daftar percakapan", async () => {
      ctx.pelaku = superAdmin;
      const { GET: ambilPengaturan, PUT } = await import("@/app/api/aleta-ai/pengaturan/route");
      const g = await json(await ambilPengaturan(req("/api/aleta-ai/pengaturan")));
      expect(g.data).toMatchObject({ pengaturan: { margin: 30, penyanggaKurs: 3, marginPersen: 30, penyanggaKursPersen: 3 } });
      // PUT menerima nama pendek yang sama (persen, bukan pecahan).
      const p = await json(await PUT(req("/api/aleta-ai/pengaturan", { method: "PUT", body: JSON.stringify({ pengaturan: { margin: 35, penyanggaKurs: 2 } }) })));
      expect(p.data).toMatchObject({ pengaturan: { margin: 35, penyanggaKurs: 2, marginPersen: 35, penyanggaKursPersen: 2 } });
      await PUT(req("/api/aleta-ai/pengaturan", { method: "PUT", body: JSON.stringify({ pengaturan: { margin: 30, penyanggaKurs: 3 } }) }));

      const { GET: proyek } = await import("@/app/api/aleta-ai/proyek/route");
      const pr = await json(await proyek(req("/api/aleta-ai/proyek")));
      expect(typeof pr.data?.versi).toBe("number");
      expect((pr.data?.modul as Array<Record<string, unknown>>)[0]).toEqual(expect.objectContaining({ nama: expect.any(String), versi: pr.data?.versi }));

      const { GET: laporan } = await import("@/app/api/aleta-ai/laporan/route");
      const lap = await json(await laporan(req("/api/aleta-ai/laporan")));
      expect(lap.data).toEqual(expect.objectContaining({ pendapatanRp: expect.any(Number), biayaApiRp: expect.any(Number), biayaMdrRp: 0, labaRp: expect.any(Number) }));
      for (const kelompok of ["perPengguna", "perPeran", "perKelompok", "perModel"]) {
        const baris = lap.data?.[kelompok] as Array<Record<string, unknown>>;
        expect(baris.length).toBeGreaterThan(0);
        expect(baris[0]).toEqual(expect.objectContaining({ nama: expect.any(String), giliran: expect.any(Number), pendapatanRp: expect.any(Number), biayaApiRp: expect.any(Number), labaRp: expect.any(Number) }));
      }

      const { GET: kurs } = await import("@/app/api/aleta-ai/kurs/route");
      expect((await json(await kurs(req("/api/aleta-ai/kurs")))).data).toEqual(expect.objectContaining({ kurs: expect.any(Number), tanggal: expect.any(String), sumber: expect.any(String) }));

      const { GET: daftarPercakapanRute } = await import("@/app/api/aleta-ai/percakapan/route");
      ctx.pelaku = { ...hakim, id: "usr-http-2" };
      const dp = await json(await daftarPercakapanRute(req("/api/aleta-ai/percakapan")));
      expect(Array.isArray(dp.data)).toBe(true);
    });
  });
});
