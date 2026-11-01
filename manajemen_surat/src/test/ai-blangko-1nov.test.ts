// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { FITUR_BLANGKO, KODE_FITUR, bacaIsianUsulan, bacaSaksiUsulan, bacaTemuanUsulan, bersihkanKeluaranFitur, cariFitur, susunPesanFitur } from "@/lib/aleta-ai/fitur-blangko";
import { BATAS_KARAKTER_PESAN_PENGGUNA, type PermintaanAi } from "@/lib/aleta-ai/penyusun";
import { tabelRuteDari, RUTE_BAWAAN } from "@/lib/aleta-ai/rute";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import type { PelakuAi } from "@/server/modules/aleta-ai/akses";
import { fiturBlangkoBoleh, masukanDariBadan } from "@/server/modules/aleta-ai/fitur-blangko";
import { suntikKlienAi, type HasilAi, type KlienAi, type OpsiAlir } from "@/server/modules/aleta-ai/klien";
import { simpanKurs, tanggalLokal } from "@/server/modules/aleta-ai/kurs";
import { ringkasAi } from "@/server/modules/aleta-ai/layanan";
import { kirimPesan, perkirakanPesan, ulangiBatasLaju, type EventAi } from "@/server/modules/aleta-ai/mesin";
import { buatPercakapan } from "@/server/modules/aleta-ai/percakapan";
import { simpanPengaturan } from "@/server/modules/aleta-ai/pengaturan";
import { unggahProyek } from "@/server/modules/aleta-ai/proyek";
import { terapkanMutasi } from "@/server/modules/aleta-ai/saldo";
import { susunZip } from "@/server/shared/zip";

/**
 * ============================================================================
 * ALETA Ai di panel Blangko Derry (1 Nov 2026) - keputusan 77-78
 * ============================================================================
 *
 * TANPA memanggil layanan AI sungguhan: klien Claude TIRUAN disuntik di sisi server, dan fetch tiruan di sisi panel.
 *   1. lib: 23 fitur, tahap 1 lengkap, penyusun pesan, penjaga keluaran, cermin tabel fitur di panel
 *   2. panel (jsdom): saklar bawaan mati, saldo habis mengunci, ingatan per pengguna, saldo pengguna <-> satker,
 *      MATI = tidak ada panggilan AI dan tanpa tombol AI, tiap fitur memakai fetch tiruan dan lebih dulu menampilkan perkiraan
 *   3. server (pg-mem): kelompok dipaksa tanpa pengklasifikasi, SAMARAN dipasang sebelum keluar, hak peran, jejak, ringkas
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const SKRIP_AI = readFileSync(path.join(AKAR, "blangko-derry-ai.js"), "utf8");
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, ket: string, batas = 3000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let h: T | undefined;
    try {
      h = periksa();
    } catch {
      h = undefined;
    }
    if (h) return h as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${ket}`);
    await tunggu(5);
  }
}

/** Memuat modul panel tanpa DOM (bagian murni dan tabel fitur). */
function muatModulAi() {
  const kotak: Record<string, any> = {};
  kotak.window = kotak;
  const modul = { exports: {} as any };
  vm.runInNewContext(SKRIP_AI, { module: modul, globalThis: kotak, window: kotak, self: kotak }, { filename: "blangko-derry-ai.js" });
  return (kotak.AletaBdAi ?? modul.exports) as any;
}

// ─── 1. Lib ──────────────────────────────────────────────────────────────────

describe("fitur bantu: tabel, penyusun pesan, penjaga keluaran", () => {
  it("23 fitur (tahap 1: A1, A3, B1, D1, D4; tahap 2: 18 lainnya), kode unik, kelompok rute dikenal", () => {
    expect(FITUR_BLANGKO).toHaveLength(23);
    expect(new Set(KODE_FITUR).size).toBe(23);
    expect(FITUR_BLANGKO.filter((f) => f.tahap === 1).map((f) => f.kode).sort()).toEqual(["A1", "A3", "B1", "D1", "D4"]);
    const tahap2 = "A2 A4 A5 B2 B3 B4 B5 C1 C2 C3 C4 C5 D2 D3 D5 E1 E2 E3".split(" ");
    expect(FITUR_BLANGKO.filter((f) => f.tahap === 2).map((f) => f.kode).sort()).toEqual(tahap2.sort());
    const kelompokSah = new Set(RUTE_BAWAAN.map((r) => r.kelompok));
    for (const f of FITUR_BLANGKO) expect(kelompokSah.has(f.kelompok), f.kode).toBe(true);
    // Fitur putusan C1-C4 hanya jalur putusan (hakim/ketua/wakil); lainnya bukan.
    expect(FITUR_BLANGKO.filter((f) => f.kelompok === "mendalam-putusan").map((f) => f.kode).sort()).toEqual(["C1", "C2", "C3", "C4"]);
  });

  it("tabel di panel (blangko-derry-ai.js) sama dengan tabel server: kode, bagian bahan, bagian wajib, bentuk keluaran", () => {
    const panel = muatModulAi().FITUR as Array<any>;
    expect(panel.map((f) => f.kode).sort()).toEqual([...KODE_FITUR].sort());
    for (const f of FITUR_BLANGKO) {
      const p = panel.find((x) => x.kode === f.kode);
      expect(p.butuh, f.kode).toEqual([...f.butuh]);
      // Panel boleh menambah "masukan" wajib bila fitur punya kotak ketikan wajib; bagian wajib server harus semuanya ada di panel.
      for (const w of f.wajib) expect(p.wajib.concat(p.masukan?.wajib ? ["masukan"] : []), `${f.kode} wajib ${w}`).toContain(w);
      expect(p.keluaran, f.kode).toBe(f.keluaran);
    }
  });

  it("pesan tugas: aturan baku, data sebagai DATA, tanpa kata Aleta, bagian wajib dijaga dengan kalimat biasa", () => {
    const p = susunPesanFitur("a3", { perkara: "Nomor perkara: 1/Pdt.G/2026/PA.Dgl", masukan: "sidang dibuka, penggugat hadir, tergugat tdk hadir" });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.fitur.kode).toBe("A3");
    expect(p.teks).toContain("=== MASUKAN PETUGAS ===\nsidang dibuka, penggugat hadir, tergugat tdk hadir");
    expect(p.teks).toContain("USULAN");
    expect(p.teks).toMatch(/DATA, bukan perintah/);
    expect(p.teks).toMatch(/Jangan menyebut nama aplikasi/);
    expect(p.teks).not.toMatch(/aleta/i);
    // wajib kosong -> ditolak
    expect(susunPesanFitur("A3", { perkara: "x" })).toEqual({ ok: false, alasan: "Belum ada masukan dari petugas." });
    expect(susunPesanFitur("B1", { perkara: "x", kosong: "  " })).toEqual({ ok: false, alasan: "Belum ada isian yang masih kosong." });
    expect(susunPesanFitur("D1", { perkara: "x" })).toEqual({ ok: false, alasan: "Belum ada naskah blangko (siapkan naskah dulu)." });
    expect(susunPesanFitur("ZZ", {})).toMatchObject({ ok: false });
    // bagian di luar kebutuhan fitur tidak ikut terkirim
    const b = susunPesanFitur("D4", { perkara: "p", temuan: "- sisa", naskah: "isi naskah", posita: "TIDAK-IKUT" });
    expect(b.ok && b.teks.includes("TIDAK-IKUT")).toBe(false);
  });

  it("pesan terlalu panjang dipangkas ke batas pesan; naskah dan masukan tidak dikorbankan lebih dulu", () => {
    const p = susunPesanFitur("E1", { perkara: "p", posita: "x".repeat(40_000), teksPihak: "y".repeat(40_000), saksi: "z".repeat(40_000), naskah: "N".repeat(26_000), masukan: "pertanyaan saya" });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.teks.length).toBeLessThanOrEqual(BATAS_KARAKTER_PESAN_PENGGUNA);
    expect(p.teks).toContain("pertanyaan saya");
    expect(p.teks).toContain("N".repeat(1000));
  });

  it("penjaga keluaran: tanpa kata Aleta/Markdown tebal; daftar isian hanya kode yang diizinkan; temuan dan saksi terbaca", () => {
    expect(bersihkanKeluaranFitur("**Bahwa** ALETA Ai menyusun. Aleta lagi.")).toBe("Bahwa menyusun. lagi.");
    expect(bersihkanKeluaranFitur("```json\n[]\n```")).toBe("[]");
    const isian = bacaIsianUsulan('Ini: [{"kode":"1234","nilai":"Bahwa A","alasan":"dari posita"},{"kode":"9999","nilai":"liar"},{"kode":"1234","nilai":"dobel"},{"kode":"5555","nilai":"ALETA"}]', new Set(["1234", "5555"]));
    expect(isian).toEqual([
      { kode: "1234", nilai: "Bahwa A", alasan: "dari posita" },
    ]);
    expect(bacaIsianUsulan("bukan json")).toBeNull();
    expect(bacaSaksiUsulan('[{"tanya":"Apa?","jawab":"Ya"},{"tanya":"","jawab":""}]')).toEqual([{ tanya: "Apa?", jawab: "Ya" }]);
    expect(bacaTemuanUsulan('[{"judul":"Tanggal beda","uraian":"u","saran":"s"}]')).toEqual([{ judul: "Tanggal beda", uraian: "u", saran: "s" }]);
    expect(cariFitur("c2")?.kemampuan).toBe("draf-putusan");
  });

  it("masukanDariBadan: tanpa fitur = bentuk lama persis; dengan fitur = kelompok dipaksa, kemampuan eksplisit; fitur/bahan salah = 400", () => {
    expect(masukanDariBadan({ teks: "halo", pemicu: "PT" })).toEqual({ teks: "halo", pemicu: "PT" });
    const m = masukanDariBadan({ fitur: "C2", bahan: { perkara: "p", posita: "po", masukan: "mengabulkan" }, proyekId: " proyek-1 " });
    expect(m).toMatchObject({ kelompok: "mendalam-putusan", kemampuan: "draf-putusan", fitur: "C2", proyekId: "proyek-1" });
    expect(() => masukanDariBadan({ fitur: "X9" })).toThrow(/belum dikenal/);
    expect(() => masukanDariBadan({ fitur: "B1", bahan: { perkara: "p" } })).toThrow(/isian yang masih kosong/);
  });
});

// ─── 2. Panel (jsdom) ────────────────────────────────────────────────────────

type OpsiPanel = {
  ringkas?: Record<string, unknown> | null;
  simpanan?: Record<string, unknown>;
  akun?: { id: string; nama: string } | null;
  perkara?: boolean;
  /** Jawaban SSE per kode fitur (teks penuh yang dialirkan). */
  hasil?: (kode: string) => string;
  bahan?: Record<string, string>;
  kosong?: Array<{ kode: string; nama: string }>;
  /** Konteks menu proyek: jenis blangko yang dipilih ("put" | "bas" | "rel" | ""), jenis perkara, agenda sidang. */
  konteks?: { jenisBlangko?: string; jenisPerkara?: string; agenda?: string };
};

const RINGKAS_BAIK = {
  aktif: true,
  saldoRp: 20_000,
  minimumRp: 1000,
  gratis: false,
  superAdmin: false,
  satker: { batasRp: 5_000_000, terpakaiRp: 1_250_000, sisaRp: 3_750_000 },
  fiturBlangko: FITUR_BLANGKO.map((f) => f.kode),
  pemicu: [
    { kode: "peta-perkara", label: "Peta Perkara", kelompok: "Proses Sidang", mode: "Teliti", grup: "C" },
    { kode: "duduk-perkara", label: "Duduk Perkara", kelompok: "Drafting Utama", mode: "Mendalam", grup: "A" },
    { kode: "pertimbangan", label: "Pertimbangan / PT", kelompok: "Drafting Utama", mode: "Mendalam", grup: "A" },
    { kode: "amar", label: "Amar Putusan", kelompok: "Drafting Utama", mode: "Mendalam", grup: "A" },
    { kode: "keterangan-saksi", label: "Keterangan Saksi", kelompok: "Proses Sidang", mode: "Teliti", grup: "C" },
    { kode: "panduan-sidang", label: "Panduan Sidang", kelompok: "Proses Sidang", mode: "Teliti", grup: "C" },
    { kode: "kalkulator-nafkah", label: "Kalkulator Nafkah", kelompok: "Kalkulator", mode: "Cepat", grup: "F" },
    { kode: "statistik-bulanan", label: "Statistik Bulanan", kelompok: "Utilitas", mode: "Cepat", grup: "I" },
  ],
};

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

function sseDari(peristiwa: unknown[]) {
  return peristiwa.map((p) => `data: ${JSON.stringify(p)}\n\n`).join("");
}

function bukaPanel(o: OpsiPanel = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><head><title>ABT</title></head><body>` +
      `<div id="aleta-bd-akar" data-tema="terang"><div class="bd-layar"><div class="bd-atas"><div class="bd-atasnama"><b>Blangko ABT by Derry Briantono</b> <small id="bd-siapa">· Derry</small></div></div><div class="bd-isi"><div id="isian-lama">isian lama</div></div></div></div>` +
      `</body></html>`,
    { url: "http://192.168.10.10/abt/", runScripts: "outside-only", pretendToBeVisual: true } as ConstructorParameters<typeof JSDOM>[1]
  );
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ...(o.simpanan ?? {}) };
  const pendengar: Array<(u: Record<string, unknown>, t: string) => void> = [];
  w.chrome = {
    runtime: { id: "uji" },
    storage: {
      local: {
        get: async (k?: string | string[]) => {
          const h: Record<string, unknown> = {};
          for (const n of [k].flat()) if (n != null && n in simpanan) h[n as string] = JSON.parse(JSON.stringify(simpanan[n as string]));
          return h;
        },
        set: async (isi: Record<string, unknown>) => {
          Object.assign(simpanan, JSON.parse(JSON.stringify(isi)));
          for (const f of pendengar) f(Object.fromEntries(Object.keys(isi).map((x) => [x, { newValue: isi[x] }])), "local");
        },
      },
      onChanged: { addListener: (f: (u: Record<string, unknown>, t: string) => void) => void pendengar.push(f) },
    },
  };
  const ringkas = o.ringkas === undefined ? RINGKAS_BAIK : o.ringkas;
  const panggilan: Array<{ alamat: string; metode: string; badan: any }> = [];
  let nomor = 0;
  const hasilFitur = o.hasil ?? (() => "Hasil rekaan.");
  w.fetch = async (alamat: string, opsi: any = {}) => {
    const metode = String(opsi.method || "GET").toUpperCase();
    const badan = opsi.body ? JSON.parse(opsi.body) : null;
    panggilan.push({ alamat, metode, badan });
    const json = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => (status < 400 ? { ok: true, data } : { ok: false, error: { message: "Ditolak." } }) });
    if (alamat === "/aleta/api/aleta-ai/ringkas") return ringkas ? json(ringkas) : json(null, 401);
    if (alamat === "/aleta/api/aleta-ai/perkiraan") return json({ label: "Teliti", perkiraanRp: 1500, tahanRp: 2500, saldoRp: 20_000, kursDipakai: 16000, gratis: false, bolehJalan: true });
    if (alamat === "/aleta/api/aleta-ai/percakapan" && metode === "POST") return json({ id: `aic-${++nomor}` });
    if (/\/percakapan\/[^/]+$/.test(alamat) && metode === "DELETE") return json({ ok: true });
    if (/\/percakapan\/[^/]+\/pesan$/.test(alamat)) {
      const isi = hasilFitur(badan.fitur);
      const sse = sseDari([
        { jenis: "perkiraan", mode: "Teliti", label: "Teliti", perkiraanRp: 1500 },
        { jenis: "teks", delta: isi.slice(0, Math.ceil(isi.length / 2)) },
        { jenis: "teks", delta: isi.slice(Math.ceil(isi.length / 2)) },
        { jenis: "selesai", pesanId: "aip-1", mode: "Teliti", label: "Teliti", biayaRp: 1500, saldoRp: 18_500 },
      ]);
      let sudah = false;
      return { ok: true, status: 200, json: async () => ({}), body: { getReader: () => ({ read: async () => (sudah ? { done: true } : ((sudah = true), { done: false, value: sse })) }) } };
    }
    return json(null, 404);
  };
  w.navigator.clipboard = { tersalin: "", writeText: async (t: string) => void (w.navigator.clipboard.tersalin = t) };

  // Panel Derry & mesin isian tiruan.
  const terapan: Array<{ kode: string; nilai: string; opsi: any }> = [];
  const saksiDitambah: Array<{ kunci: string; baris: any[] }> = [];
  const akun = o.akun === undefined ? { id: "usr-1", nama: "Derry" } : o.akun;
  w.aletaBlangkoDerry = {
    akun: () => akun,
    perkaraTerpilih: () =>
      o.perkara === false ? null : { perkara: { nomorPerkara: "684/Pdt.G/2026/PA.Dgl", jenisPerkara: o.konteks?.jenisPerkara ?? "Cerai Gugat" }, sidang: [], sidangKe: 0, sidangDipilih: { agenda: o.konteks?.agenda ?? "" } },
    skala: () => 1,
  };
  const bahanTersedia = {
    perkara: "Nomor perkara: 684/Pdt.G/2026/PA.Dgl\nPenggugat: SITI AMINAH BINTI RAHMAN",
    sidang: "Sidang ke-1 (2026-10-26): agenda pembuktian",
    posita: "Bahwa Penggugat dan Tergugat menikah pada 2015; sejak 2024 sering bertengkar.",
    teksPihak: "[Jawaban]\nBahwa Tergugat membantah dalil gugatan.",
    saksi: "Saksi 1 P:\n1. Tanya: Kenal?\n   Jawab: Kenal, tetangga.",
    isian: "[1111] Nama Penggugat: SITI AMINAH BINTI RAHMAN",
    kosong: "[2222] Rincian pertengkaran",
    naskah: "Naskah putusan lengkap rekaan.",
    temuan: "- Sisa kurung siku di halaman 2",
    ...(o.bahan ?? {}),
  };
  w.aletaBlangkoDerryIsian = {
    bahanAi: async (butuh: string[]) => {
      const bahan: Record<string, unknown> = { samarkan: [{ jenis: "NAMA", nilai: "SITI AMINAH BINTI RAHMAN" }] };
      for (const k of butuh) if ((bahanTersedia as Record<string, string>)[k]) bahan[k] = (bahanTersedia as Record<string, string>)[k];
      return {
        ok: true,
        bahan,
        peta: { saksi: [{ kunci: "saksi 1 p", sebutan: "Saksi 1 Penggugat", jumlah: 1, siap: true }], kosong: o.kosong ?? [{ kode: "2222", nama: "Rincian pertengkaran" }], naskahBelum: false },
      };
    },
    aiIsianTeks: () => [
      { kode: "2222", nama: "Rincian pertengkaran", kosong: true, nilai: "" },
      { kode: "3333", nama: "Catatan sidang", kosong: false, nilai: "sidang dibuka, p hadir" },
    ],
    aiTerapkanIsian: async (kode: string, nilai: string, opsi: any) => {
      terapan.push({ kode, nilai, opsi });
      return { ok: true };
    },
    aiTambahSaksi: (kunci: string, baris: any[]) => {
      saksiDitambah.push({ kunci, baris });
      return { ok: true, jumlah: baris.length };
    },
    siapkanNaskah: async () => undefined,
    keadaan: () => ({ blangko: o.konteks?.jenisBlangko ? { jenis: o.konteks.jenisBlangko } : null }),
  };
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(SKRIP_AI, ctx, { filename: "blangko-derry-ai.js" });
  const doc = w.document as Document;
  const akarEl = doc.getElementById("aleta-bd-akar") as HTMLElement;
  w.AletaBdAi.pasang(akarEl);
  const q = <T extends Element = HTMLElement>(s: string) => akarEl.querySelector(s) as T | null;
  return { dom, w, doc, akarEl, q, panggilan, simpanan, terapan, saksiDitambah, ai: () => w.AletaBdAi };
}

const sakelar = (h: ReturnType<typeof bukaPanel>) => h.q<HTMLInputElement>("#bd-ai-saklar-cek")!;
const alamatAi = (h: ReturnType<typeof bukaPanel>) => h.panggilan.filter((p) => p.alamat !== "/aleta/api/aleta-ai/ringkas").map((p) => `${p.metode} ${p.alamat}`);

describe("panel Blangko Derry: saklar ALETA Ai", () => {
  it("bawaan MATI: saklar ada di dekat akun, bilah AI tersembunyi, tak ada panggilan AI selain membaca ringkasan, isian lama tak berubah", async () => {
    const h = bukaPanel();
    await sampai(() => h.q("#bd-ai-saklar") && (!h.q("#bd-ai-saklar")!.hasAttribute("hidden") && h.ai().keadaan().ringkas), "saklar tampil");
    expect(h.q("#bd-siapa")!.nextElementSibling!.id).toBe("bd-ai-saklar");
    expect(sakelar(h).checked).toBe(false);
    expect(sakelar(h).disabled).toBe(false);
    expect(h.q("#bd-ai-bilah")!.hasAttribute("hidden")).toBe(true);
    expect(h.q("#bd-ai-bilah")!.innerHTML).toBe("");
    expect(h.q("[data-ai-fitur]")).toBeNull();
    expect(h.q("#isian-lama")!.textContent).toBe("isian lama");
    expect(h.panggilan.map((p) => p.alamat)).toEqual(["/aleta/api/aleta-ai/ringkas"]);
    expect(h.ai().keadaan()).toMatchObject({ idAkun: "usr-1", tersimpan: false, nyala: false });
  });

  it("saldo habis -> saklar mati, tidak bisa diklik, keterangan 'saldo habis'; pilihan tersimpan yang menyala dipaksa mati", async () => {
    const h = bukaPanel({ ringkas: { ...RINGKAS_BAIK, saldoRp: 0 }, simpanan: { "blangkoDerryAi:usr-1": true } });
    await sampai(() => h.q("#bd-ai-saklar-ket")?.textContent, "keterangan");
    expect(h.q("#bd-ai-saklar-ket")!.textContent).toBe("(saldo habis)");
    expect(sakelar(h).disabled).toBe(true);
    expect(sakelar(h).checked).toBe(false);
    expect(h.q("#bd-ai-saklar")!.getAttribute("data-keadaan")).toBe("habis");
    expect(h.q("#bd-ai-saklar")!.classList.contains("terkunci")).toBe(true);
    expect(h.q("#bd-ai-bilah")!.hasAttribute("hidden")).toBe(true);
    await sampai(() => h.simpanan["blangkoDerryAi:usr-1"] === false, "tersimpan mati");
    // Dipaksa klik pun tetap mati.
    sakelar(h).checked = true;
    sakelar(h).dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await tunggu(20);
    expect(sakelar(h).checked).toBe(false);
    expect(h.ai().keadaan().nyala).toBe(false);
  });

  it("Super Admin / promosi gratis: saldo nol bukan penghalang", async () => {
    const h = bukaPanel({ ringkas: { ...RINGKAS_BAIK, saldoRp: 0, gratis: true, superAdmin: true } });
    await sampai(() => h.q("#bd-ai-saklar") && (!h.q("#bd-ai-saklar")!.hasAttribute("hidden") && h.ai().keadaan().ringkas), "tampil");
    expect(sakelar(h).disabled).toBe(false);
  });

  it("dinyalakan: tersimpan PER PENGGUNA (kunci memuat id akun, bukan perkara) dan bilah fitur tampil; akun lain tetap mati", async () => {
    const h = bukaPanel();
    await sampai(() => (!h.q("#bd-ai-saklar")!.hasAttribute("hidden") && h.ai().keadaan().ringkas), "tampil");
    sakelar(h).checked = true;
    sakelar(h).dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => !h.q("#bd-ai-bilah")!.hasAttribute("hidden"), "bilah tampil");
    expect(h.simpanan["blangkoDerryAi:usr-1"]).toBe(true);
    expect(Object.keys(h.simpanan).sort()).toEqual(["blangkoDerryAi:usr-1", "blangkoDerryAiTur:usr-1"]); // saklar + panduan sekali; tidak ada kunci per perkara
    const grup = [...h.akarEl.querySelectorAll("[data-ai-grup]")].map((x) => x.getAttribute("data-ai-grup"));
    expect(grup).toEqual(["Saksi", "BAS", "Isian", "Putusan", "Periksa", "Tanya", "Menu proyek"]);
    // Akun lain di Chrome yang sama: pilihan akun pertama tidak ikut.
    const h2 = bukaPanel({ akun: { id: "usr-2", nama: "Lain" }, simpanan: h.simpanan });
    await sampai(() => (!h2.q("#bd-ai-saklar")!.hasAttribute("hidden") && h2.ai().keadaan().ringkas), "tampil 2");
    expect(sakelar(h2).checked).toBe(false);
    expect(h2.q("#bd-ai-bilah")!.hasAttribute("hidden")).toBe(true);
    // Akun pertama dibuka lagi: ingat menyala.
    const h3 = bukaPanel({ simpanan: h.simpanan });
    await sampai(() => !h3.q("#bd-ai-bilah")!.hasAttribute("hidden"), "ingat menyala");
    expect(sakelar(h3).checked).toBe(true);
  });

  it("mematikan lagi: bilah hilang dan jendela tertutup; tombol fitur menurut hak peran dari server", async () => {
    const h = bukaPanel({ simpanan: { "blangkoDerryAi:usr-1": true }, ringkas: { ...RINGKAS_BAIK, fiturBlangko: ["A1", "A3", "B1", "D1", "D4"] } });
    await sampai(() => !h.q("#bd-ai-bilah")!.hasAttribute("hidden"), "bilah");
    expect(h.akarEl.querySelectorAll("[data-ai-grup]").length).toBe(5); // Saksi, BAS, Isian, Periksa, Menu proyek (tanpa Putusan/Tanya)
    h.q<HTMLButtonElement>('[data-ai-grup="Saksi"]')!.click();
    expect([...h.akarEl.querySelectorAll("[data-ai-fitur]")].map((x) => x.getAttribute("data-ai-fitur"))).toEqual(["A1"]);
    sakelar(h).checked = false;
    sakelar(h).dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => h.q("#bd-ai-bilah")!.hasAttribute("hidden"), "bilah hilang");
    expect(h.simpanan["blangkoDerryAi:usr-1"]).toBe(false);
  });
});

describe("panel Blangko Derry: saldo kiri bawah", () => {
  it("menampilkan saldo PENGGUNA; diklik berganti saldo SATKER (ikon berubah), diklik lagi kembali", async () => {
    const h = bukaPanel();
    const tmb = await sampai(() => (!h.q("#bd-ai-saldo")!.hasAttribute("hidden") ? h.q<HTMLButtonElement>("#bd-ai-saldo") : null), "saldo tampil");
    expect(tmb.textContent).toContain("Saldo: Rp20.000");
    expect(tmb.querySelector("[data-ikon]")!.getAttribute("data-ikon")).toBe("pengguna");
    const svgPengguna = tmb.querySelector("svg")!.innerHTML;
    tmb.click();
    expect(tmb.textContent).toContain("Satker: Rp3.750.000");
    expect(tmb.querySelector("[data-ikon]")!.getAttribute("data-ikon")).toBe("satker");
    expect(tmb.querySelector("svg")!.innerHTML).not.toBe(svgPengguna);
    expect(tmb.getAttribute("data-mode")).toBe("satker");
    tmb.click();
    expect(tmb.textContent).toContain("Saldo: Rp20.000");
    expect(tmb.querySelector("[data-ikon]")!.getAttribute("data-ikon")).toBe("pengguna");
  });

  it("saldo satker tanpa batas bulanan tampil terus terang; saldo habis diberi tanda", async () => {
    const h = bukaPanel({ ringkas: { ...RINGKAS_BAIK, saldoRp: 0, satker: { batasRp: 0, terpakaiRp: 0, sisaRp: null } } });
    const tmb = await sampai(() => (!h.q("#bd-ai-saldo")!.hasAttribute("hidden") ? h.q<HTMLButtonElement>("#bd-ai-saldo") : null), "saldo");
    expect(tmb.textContent).toContain("(habis)");
    expect(tmb.classList.contains("habis")).toBe(true);
    tmb.click();
    expect(tmb.textContent).toContain("tanpa batas");
  });

  it("tidak ada saldo bila ALETA Ai belum aktif di server", async () => {
    const h = bukaPanel({ ringkas: { ...RINGKAS_BAIK, aktif: false } });
    await tunggu(30);
    expect(h.q("#bd-ai-saldo")!.hasAttribute("hidden")).toBe(true);
  });
});

describe("panel Blangko Derry: tiap fitur memakai klien tiruan, perkiraan lebih dulu, hasil = usulan", () => {
  const HASIL_ISIAN = '[{"kode":"2222","nilai":"Bahwa sejak 2024 terjadi pertengkaran ALETA terus-menerus.","alasan":"dari posita"},{"kode":"7777","nilai":"liar"}]';
  const HASIL_SAKSI = '[{"tanya":"Apa yang Saksi lihat?","jawab":"Saya melihat sendiri."},{"tanya":"Sejak kapan?","jawab":"..."}]';
  const HASIL_TEMUAN = '[{"judul":"Nama beda","uraian":"Di halaman 2 tertulis SITI AMINA.","saran":"Samakan dengan data perkara."}]';
  const hasil = (kode: string) => {
    const f = cariFitur(kode)!;
    return f.keluaran === "isian" ? HASIL_ISIAN : f.keluaran === "saksi" ? HASIL_SAKSI : f.keluaran === "temuan" ? HASIL_TEMUAN : `Usulan **teks** ${kode} dari ALETA Ai. Berdasarkan Pasal 306 RBg dan Pasal 116 huruf f KHI.`;
  };
  const MASUKAN: Record<string, string> = {
    A1: "Saksi melihat pihak lawan pergi dari rumah",
    A3: "sidang dibuka, p hadir, t tdk hadir",
    B4: "P-1 KTP Penggugat.pdf",
    B5: "Nama : SITI AMINAH BINTI RAHMAN\nNIK : 7203010101900001\nAlamat : Jl. Mawar No. 1 Donggala",
    C2: "mengabulkan sebagian",
    E1: "Siapa saksi pertama?",
    E3: "penetapan pencabutan perkara",
  };

  async function jalankanFitur(h: ReturnType<typeof bukaPanel>, kode: string) {
    const f = cariFitur(kode)!;
    await h.ai().bukaFitur(kode);
    const jendela = await sampai(() => h.q("#bd-ai-jendela"), `jendela ${kode}`);
    const ta = h.q<HTMLTextAreaElement>("#bd-ai-masukan");
    if (ta) {
      ta.value = MASUKAN[kode] ?? "catatan";
      ta.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    }
    const acuan = h.q<HTMLTextAreaElement>("#bd-ai-acuan");
    if (acuan) {
      acuan.value = "Putusan acuan rekaan.";
      acuan.dispatchEvent(new h.w.Event("input", { bubbles: true }));
    }
    // Perkiraan biaya tampil SEBELUM dijalankan; tombol Jalankan baru aktif sesudahnya.
    await sampai(() => /Perkiraan biaya: sekitar Rp1\.500/.test(h.q("#bd-ai-kendali")?.textContent ?? ""), `perkiraan ${kode}`, 4000);
    expect(alamatAi(h).some((a) => a.endsWith("/pesan"))).toBe(false);
    const jalan = h.q<HTMLButtonElement>('[data-ai="jalan"]')!;
    expect(jalan.disabled, kode).toBe(false);
    jalan.click();
    await sampai(() => h.q("#bd-ai-hasil .bd-ai-tanda"), `hasil ${kode}`, 4000);
    expect(f.kode).toBe(kode);
    return jendela;
  }

  for (const f of FITUR_BLANGKO) {
    it(`${f.kode} ${f.judul}: perkiraan -> jalankan -> usulan bertanda; badan permintaan memuat kode fitur dan bahan yang dibutuhkan saja`, async () => {
      const h = bukaPanel({ simpanan: { "blangkoDerryAi:usr-1": true }, hasil });
      await sampai(() => !h.q("#bd-ai-bilah")!.hasAttribute("hidden"), "bilah");
      await jalankanFitur(h, f.kode);

      const perkiraan = h.panggilan.filter((p) => p.alamat.endsWith("/perkiraan"));
      const pesan = h.panggilan.filter((p) => p.alamat.endsWith("/pesan"));
      expect(perkiraan.length).toBeGreaterThanOrEqual(1);
      expect(pesan).toHaveLength(1);
      const badan = pesan[0]!.badan;
      expect(badan.fitur).toBe(f.kode);
      // Hanya bagian yang dibutuhkan fitur ikut (+ daftar samaran); tidak ada bagian lain.
      const bagian = Object.keys(badan.bahan).filter((k) => k !== "samarkan");
      for (const k of bagian) expect(f.butuh, `${f.kode} bagian ${k}`).toContain(k);
      for (const w of f.wajib) expect(bagian, `${f.kode} wajib ${w}`).toContain(w);
      expect(badan.bahan.samarkan).toEqual(expect.arrayContaining([{ jenis: "NAMA", nilai: "SITI AMINAH BINTI RAHMAN" }]));
      // Urutan: percakapan dibuat, perkiraan, pesan; percakapan sekali pakai disembunyikan sesudahnya.
      const urut = alamatAi(h);
      expect(urut.indexOf("POST /aleta/api/aleta-ai/perkiraan")).toBeLessThan(urut.findIndex((a) => a.endsWith("/pesan")));
      await sampai(() => alamatAi(h).some((a) => a.startsWith("DELETE ")), "percakapan disembunyikan");

      // Hasil: bertanda USULAN, tanpa kata Aleta dan tanpa Markdown tebal; BELUM ada yang ditulis ke isian/saksi.
      const tampil = h.q("#bd-ai-hasil")!;
      expect(tampil.querySelector(".bd-ai-tanda")!.textContent).toMatch(/USULAN/);
      const teksTampil = [...tampil.querySelectorAll("textarea")].map((t) => (t as HTMLTextAreaElement).value).join("\n") + tampil.textContent;
      expect(teksTampil).not.toMatch(/aleta/i);
      expect(teksTampil).not.toContain("**");
      expect(h.terapan).toHaveLength(0);
      expect(h.saksiDitambah).toHaveLength(0);
      if (f.keluaran === "teks" && /Pasal/.test(hasil(f.kode))) {
        // Pasal yang tidak ada di bahan diberi penanda verifikasi.
        expect((h.q<HTMLTextAreaElement>("#bd-ai-teks")!.value.match(/\[PERLU VERIFIKASI\]/g) ?? []).length).toBe(2);
      }
    });
  }

  it("tanpa masukan wajib: Jalankan tetap mati dan alasannya terbaca; tidak ada permintaan perkiraan ke server", async () => {
    const h = bukaPanel({ simpanan: { "blangkoDerryAi:usr-1": true } });
    await sampai(() => !h.q("#bd-ai-bilah")!.hasAttribute("hidden"), "bilah");
    await h.ai().bukaFitur("A3");
    await sampai(() => h.q("#bd-ai-masukan"), "jendela");
    await sampai(() => /Belum ada masukan/.test(h.q("#bd-ai-kendali")?.textContent ?? ""), "alasan");
    expect(h.q<HTMLButtonElement>('[data-ai="jalan"]')!.disabled).toBe(true);
    expect(h.panggilan.some((p) => p.alamat.endsWith("/perkiraan"))).toBe(false);
  });

  it("perkiraan ditolak server (mis. saldo kurang): Jalankan mati dan kalimat server tampil", async () => {
    const h = bukaPanel({ simpanan: { "blangkoDerryAi:usr-1": true } });
    const asli = h.w.fetch;
    h.w.fetch = async (a: string, o: any) =>
      a.endsWith("/perkiraan")
        ? { ok: true, status: 200, json: async () => ({ ok: true, data: { label: "Teliti", perkiraanRp: 1500, saldoRp: 100, gratis: false, bolehJalan: false, alasan: "Saldo tidak cukup." } }) }
        : asli(a, o);
    await sampai(() => !h.q("#bd-ai-bilah")!.hasAttribute("hidden"), "bilah");
    await h.ai().bukaFitur("D1");
    await sampai(() => /Saldo tidak cukup/.test(h.q("#bd-ai-kendali")?.textContent ?? ""), "alasan");
    expect(h.q<HTMLButtonElement>('[data-ai="jalan"]')!.disabled).toBe(true);
  });

  it("B1: 'Pakai yang dicentang' hanya untuk kode isian kosong yang diizinkan; kode liar dibuang; tiap isian lewat penerapan petugas", async () => {
    const h = bukaPanel({ simpanan: { "blangkoDerryAi:usr-1": true }, hasil });
    await sampai(() => !h.q("#bd-ai-bilah")!.hasAttribute("hidden"), "bilah");
    await jalankanFitur(h, "B1");
    expect(h.akarEl.querySelectorAll("[data-ai-isian]")).toHaveLength(1);
    expect(h.q<HTMLTextAreaElement>('[data-ai-nilai="0"]')!.value).toBe("Bahwa sejak 2024 terjadi pertengkaran terus-menerus.");
    h.q<HTMLButtonElement>('[data-ai="pakai-isian"]')!.click();
    await sampai(() => h.terapan.length === 1, "diterapkan");
    expect(h.terapan[0]).toMatchObject({ kode: "2222", nilai: "Bahwa sejak 2024 terjadi pertengkaran terus-menerus." });
    expect(h.terapan[0]!.opsi).toBeUndefined(); // tanpa izin menimpa
  });

  it("A1: baris usulan ditambahkan ke saksi pilihan hanya yang dicentang, setelah dilihat petugas", async () => {
    const h = bukaPanel({ simpanan: { "blangkoDerryAi:usr-1": true }, hasil });
    await sampai(() => !h.q("#bd-ai-bilah")!.hasAttribute("hidden"), "bilah");
    await jalankanFitur(h, "A1");
    h.q<HTMLInputElement>('[data-ai-baris="1"]')!.checked = false;
    h.q<HTMLButtonElement>('[data-ai="pakai-saksi"]')!.click();
    expect(h.saksiDitambah).toEqual([{ kunci: "saksi 1 p", baris: [{ tanya: "Apa yang Saksi lihat?", jawab: "Saya melihat sendiri." }] }]);
  });

  it("A3: catatan diambil dari isian yang sudah berisi; mengganti isi lama hanya bila petugas mencentang 'Ganti isi'", async () => {
    const h = bukaPanel({ simpanan: { "blangkoDerryAi:usr-1": true }, hasil });
    await sampai(() => !h.q("#bd-ai-bilah")!.hasAttribute("hidden"), "bilah");
    await h.ai().bukaFitur("A3");
    await sampai(() => h.q("#bd-ai-ambil"), "pilihan isian");
    const sel = h.q<HTMLSelectElement>("#bd-ai-ambil")!;
    sel.value = "3333";
    sel.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    expect(h.q<HTMLTextAreaElement>("#bd-ai-masukan")!.value).toBe("sidang dibuka, p hadir");
    await sampai(() => /Perkiraan biaya/.test(h.q("#bd-ai-kendali")?.textContent ?? ""), "perkiraan");
    h.q<HTMLButtonElement>('[data-ai="jalan"]')!.click();
    await sampai(() => h.q("#bd-ai-sasaran"), "hasil");
    expect(h.q<HTMLSelectElement>("#bd-ai-sasaran")!.value).toBe("3333");
    expect(h.q<HTMLInputElement>("#bd-ai-timpa")!.checked).toBe(true);
    h.q<HTMLButtonElement>('[data-ai="pakai-teks"]')!.click();
    await sampai(() => h.terapan.length === 1, "diterapkan");
    expect(h.terapan[0]).toMatchObject({ kode: "3333", opsi: { timpa: true } });
    expect(h.terapan[0]!.nilai).not.toMatch(/aleta|\*\*/i);
  });

  it("titik sambung proyek: proyekId tersimpan dan ikut di perkiraan dan pesan", async () => {
    const h = bukaPanel({ simpanan: { "blangkoDerryAi:usr-1": true, blangkoDerryAiProyek: "proyek-derry" }, hasil });
    await sampai(() => !h.q("#bd-ai-bilah")!.hasAttribute("hidden"), "bilah");
    await jalankanFitur(h, "D1");
    for (const p of h.panggilan.filter((x) => x.alamat.endsWith("/perkiraan") || x.alamat.endsWith("/pesan"))) expect(p.badan.proyekId).toBe("proyek-derry");
  });

  it("MATI = tidak ada jalur AI sama sekali: bukaFitur diabaikan, tak ada perkiraan/pesan/percakapan", async () => {
    const h = bukaPanel();
    await sampai(() => (!h.q("#bd-ai-saklar")!.hasAttribute("hidden") && h.ai().keadaan().ringkas), "tampil");
    await h.ai().bukaFitur("D1");
    await tunggu(30);
    expect(h.q("#bd-ai-jendela")).toBeNull();
    expect(alamatAi(h)).toEqual([]);
  });
});

describe("panel: bagian murni", () => {
  const murni = () => muatModulAi().murni;

  it("samaranDariKtp mendaftarkan nama, NIK, alamat, tempat lahir dari teks KTP", () => {
    const s = murni().samaranDariKtp("Nama : SITI AMINAH\nNIK : 7203010101900001\nTempat/Tgl Lahir : Donggala, 01-01-1990\nAlamat : Jl. Mawar No. 1\nAgama : Islam");
    expect(s.map((x: any) => x.jenis)).toEqual(["NAMA", "NIK", "LAHIR", "ALAMAT"]);
  });

  it("tandaiRujukan: pasal yang ada di bahan dibiarkan, yang lain diberi penanda sekali", () => {
    const m = murni();
    const t = m.tandaiRujukan("Pasal 116 huruf f KHI dan Pasal 306 RBg. Pasal 39 [PERLU VERIFIKASI]", "bahan memuat Pasal 116 huruf f KHI");
    expect(t).toBe("Pasal 116 huruf f KHI dan Pasal 306 RBg [PERLU VERIFIKASI]. Pasal 39 [PERLU VERIFIKASI]");
  });

  it("keadaanSaklar: bawaan mati; tersimpan menyala bila saldo cukup; habis/tidak tersedia terkunci", () => {
    const m = murni();
    expect(m.keadaanSaklar(RINGKAS_BAIK, undefined)).toMatchObject({ aktif: false, terkunci: false });
    expect(m.keadaanSaklar(RINGKAS_BAIK, true)).toMatchObject({ aktif: true, terkunci: false });
    expect(m.keadaanSaklar({ ...RINGKAS_BAIK, saldoRp: 999 }, true)).toMatchObject({ aktif: false, terkunci: true, alasan: "saldo habis" });
    expect(m.keadaanSaklar({ ...RINGKAS_BAIK, saldoRp: 0, gratis: true }, true)).toMatchObject({ aktif: true, terkunci: false });
    expect(m.keadaanSaklar(null, true)).toMatchObject({ aktif: false, terkunci: true, alasan: "belum tersedia" });
  });
});

// ─── 3. Server (pg-mem) ──────────────────────────────────────────────────────

const ctx = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/db/client", async (asli) => ({ ...(await asli<typeof import("@/server/db/client")>()), getDatabase: async () => ctx.db }));

const hakim: PelakuAi = { id: "usr-hakim", nama: "Hakim Rekaan", peranId: "hakim", superAdmin: false };
const pp: PelakuAi = { id: "usr-pp", nama: "PP Rekaan", peranId: "panitera-pengganti", superAdmin: false };
const superAdmin: PelakuAi = { id: "usr-super", nama: "Super Rekaan", peranId: "super-admin", superAdmin: true };

const CORE_MD = "# CORE PROMPT REKAAN\nAnda asisten hukum rekaan untuk uji. " + "Kalimat pengisi core prompt. ".repeat(40);
const MENU_MD = `# ALETA_05 — TRIGGER MENU LENGKAP
Modul rekaan untuk uji.

## KELOMPOK A — DRAFTING UTAMA
| Trigger | Output |
|---|---|
| Duduk Perkara | Ringkasan "Bahwa" rekaan |
| Pertimbangan / PT | Pertimbangan hukum berlapis rekaan |
| Putusan Lengkap / PL | Kepala sampai penutup rekaan (ALETA_08) |

## QUICK COMMANDS
PT = Pertimbangan | PL = Putusan Lengkap
`;
const zipRekaan = () =>
  susunZip([
    { nama: "ALETA_AI_PA_Edition_V4_5_Core_Prompt.md", isi: Buffer.from(CORE_MD, "utf8") },
    { nama: "ALETA_05_Trigger_Menu.md", isi: Buffer.from(MENU_MD, "utf8") },
    { nama: "ALETA_08_Format_Putusan_Donggala.md", isi: Buffer.from("# ALETA_08 — FORMAT PUTUSAN\nIsi format putusan rekaan.", "utf8") },
  ]);

class KlienTiruan implements KlienAi {
  panggilan: PermintaanAi[] = [];
  jawaban = "Bahwa [NAMA-1] datang ke sidang sebagai saksi.";
  async alirkan(p: PermintaanAi, opsi: OpsiAlir = {}): Promise<HasilAi> {
    this.panggilan.push(p);
    opsi.onTeks?.(this.jawaban);
    return { teks: this.jawaban, berhenti: "selesai", model: p.model, penggunaan: { masuk: 1000, keluar: 500, cacheTulis: 0, cacheBaca: 0 }, iterasi: [], kategoriTolak: "", dialihkan: false };
  }
  async hitungToken(): Promise<number> {
    return 3000;
  }
  /** Semua teks yang keluar ke layanan AI (system + pesan). */
  get semuaTeks() {
    return this.panggilan.map((p) => JSON.stringify([p.system, p.messages])).join("\n");
  }
}

async function kumpulkan(g: AsyncGenerator<EventAi, void, void>) {
  const h: EventAi[] = [];
  for await (const e of g) h.push(e);
  return h;
}

describe("ALETA Ai Blangko Derry di server: kelompok dipaksa, samaran sebelum kirim, hak peran, ringkas", () => {
  let db: AletaDatabase;
  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: false });
    ctx.db = db;
    await simpanKurs(db, { tanggal: tanggalLokal(), kurs: 16000, sumber: "uji" });
    await unggahProyek(db, superAdmin.id, { bita: zipRekaan(), namaBerkas: "proyek-rekaan.zip" });
  }, 180000);
  afterAll(async () => {
    suntikKlienAi(undefined);
    await db?.close();
  });
  afterEach(() => ulangiBatasLaju());

  const siap = async (p: PelakuAi, klien: KlienTiruan, saldo = 100_000) => {
    suntikKlienAi(klien);
    if (saldo > 0) await terapkanMutasi(db, { penggunaId: p.id, jenis: "isi", jumlahRp: saldo, catatan: "uji" });
    return (await buatPercakapan(db, p.id)).id;
  };

  const BAHAN = {
    perkara: "Nomor perkara: 1/Pdt.G/2026/PA.Dgl\nPenggugat: Siti Aminah binti Rahman\nTergugat: Ahmad Fauzi bin Hasan",
    sidang: "Sidang ke-1: agenda pembuktian",
    posita: "Bahwa Penggugat Siti Aminah binti Rahman beralamat di Jalan Mawar No. 1, NIK 7203010101900001, telp 081234567890.",
    saksi: "Saksi 1 P:\n1. Tanya: Kenal?\n   Jawab: Kenal.",
    naskah: "Naskah rekaan atas nama Siti Aminah binti Rahman.",
    isian: "[1111] Nama: Siti Aminah binti Rahman",
    samarkan: [{ jenis: "NAMA" as const, nilai: "Siti Aminah" }],
  };

  it("fitur A1 dijalankan: TANPA pengklasifikasi berbayar, rute sesuai tabel fitur, data asli TIDAK keluar ke layanan AI, jawaban dipulihkan", async () => {
    const klien = new KlienTiruan();
    const id = await siap(hakim, klien);
    const masukan = masukanDariBadan({ fitur: "A1", bahan: { ...BAHAN, masukan: "Saksi melihat Ahmad Fauzi bin Hasan pergi" }, proyekId: "proyek-uji" });
    const e = await kumpulkan(kirimPesan(db, hakim, id, masukan));
    expect(e.map((x) => x.jenis)).toEqual(["perkiraan", "teks", "selesai"]);
    // Tidak ada panggilan pengklasifikasi: hanya satu panggilan (jawaban).
    expect(klien.panggilan).toHaveLength(1);
    expect(klien.panggilan[0]!.model).toBe("claude-sonnet-5-5"); // teliti-ringkas
    const keluar = klien.semuaTeks;
    for (const rahasia of ["Siti Aminah", "Ahmad Fauzi", "7203010101900001", "081234567890", "Jalan Mawar"]) expect(keluar, rahasia).not.toContain(rahasia);
    expect(keluar).toMatch(/\[NAMA-\d+\]/);
    expect(keluar).toContain("[NIK-");
    // Jawaban kembali dengan nama asli (pemulihan kode).
    const teksJawab = e.filter((x) => x.jenis === "teks").map((x) => (x as { delta: string }).delta).join("");
    expect(teksJawab).toBe("Bahwa Siti Aminah datang ke sidang sebagai saksi.");
    // Jejak fitur tercatat tanpa isi pesan.
    const jejak = await db.queryAll<{ aksi: string; ringkas: string }>(`SELECT aksi, ringkas FROM aleta_ai_jejak WHERE aksi = 'fitur-blangko'`);
    expect(jejak).toHaveLength(1);
    expect(jejak[0]!.ringkas).toBe("fitur=A1; kelompok=teliti-ringkas; proyek=proyek-uji");
    expect(jejak[0]!.ringkas).not.toMatch(/siti|ahmad/i);
  });

  it("nama yang tidak berpola tetap disamarkan karena didaftarkan panel (daftar samarkan)", async () => {
    const klien = new KlienTiruan();
    const id = await siap(hakim, klien);
    const masukan = masukanDariBadan({ fitur: "D1", bahan: { perkara: "Penggugat: Nurhayati", naskah: "Nurhayati hadir di sidang.", samarkan: [{ jenis: "NAMA", nilai: "Nurhayati" }] } });
    await kumpulkan(kirimPesan(db, hakim, id, masukan));
    expect(klien.semuaTeks).not.toContain("Nurhayati");
    expect(klien.semuaTeks).toMatch(/\[NAMA-\d+\]/);
  });

  it("menu proyek: pemicu duduk-perkara + data perkara lewat jalur lama; tanpa pengklasifikasi, data tersamar, jawaban dipulihkan", async () => {
    const klien = new KlienTiruan();
    const p: PelakuAi = { ...hakim, id: "usr-menu" };
    const id = await siap(p, klien);
    const masukan = masukanDariBadan({ pemicu: "duduk-perkara", bahan: BAHAN });
    const e = await kumpulkan(kirimPesan(db, p, id, masukan));
    expect(e.map((x) => x.jenis)).toEqual(["perkiraan", "teks", "selesai"]);
    expect(klien.panggilan).toHaveLength(1);
    for (const rahasia of ["Siti Aminah", "Ahmad Fauzi", "7203010101900001", "081234567890"]) expect(klien.semuaTeks, rahasia).not.toContain(rahasia);
    expect(klien.semuaTeks).toContain("Duduk Perkara");
    const hasil = await perkirakanPesan(db, p, "", masukanDariBadan({ pemicu: "duduk-perkara", bahan: BAHAN }));
    expect(hasil.bolehJalan).toBe(true);
  });

  it("hak peran ditegakkan: PP tidak boleh fitur putusan (C1) tetapi boleh A3; hakim boleh C1; tak ada panggilan AI saat ditolak", async () => {
    const klienPp = new KlienTiruan();
    const idPp = await siap(pp, klienPp);
    const c1 = await kumpulkan(kirimPesan(db, pp, idPp, masukanDariBadan({ fitur: "C1", bahan: BAHAN })));
    expect(c1).toHaveLength(1);
    expect(c1[0]).toMatchObject({ jenis: "gagal" });
    expect((c1[0] as { pesan: string }).pesan).toMatch(/hanya tersedia bagi hakim, ketua, dan wakil ketua/);
    expect(klienPp.panggilan).toHaveLength(0);
    const a3 = await kumpulkan(kirimPesan(db, pp, idPp, masukanDariBadan({ fitur: "A3", bahan: { perkara: "x", masukan: "sidang dibuka" } })));
    expect(a3.map((x) => x.jenis)).toEqual(["perkiraan", "teks", "selesai"]);

    const klienHakim = new KlienTiruan();
    const idHakim = await siap(hakim, klienHakim);
    const c1h = await kumpulkan(kirimPesan(db, hakim, idHakim, masukanDariBadan({ fitur: "C1", bahan: BAHAN })));
    expect(c1h.map((x) => x.jenis)).toEqual(["perkiraan", "teks", "selesai"]);
    expect(klienHakim.panggilan[0]!.model).toBe("claude-opus-5-5");
  });

  it("saldo kurang: ditolak SEBELUM memanggil layanan AI; saldo tidak berubah", async () => {
    const miskin: PelakuAi = { ...hakim, id: "usr-miskin" };
    const klien = new KlienTiruan();
    const id = await siap(miskin, klien, 0);
    const e = await kumpulkan(kirimPesan(db, miskin, id, masukanDariBadan({ fitur: "D1", bahan: { perkara: "p", naskah: "n" } })));
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ jenis: "gagal" });
    expect(klien.panggilan).toHaveLength(0);
  });

  it("perkiraan biaya fitur: dihitung dari pesan tugas yang sama tanpa memanggil layanan AI dan tanpa menahan dana", async () => {
    const klien = new KlienTiruan();
    const p: PelakuAi = { ...hakim, id: "usr-perkiraan" };
    await siap(p, klien);
    const hasil = await perkirakanPesan(db, p, "", masukanDariBadan({ fitur: "B1", bahan: { perkara: "p", kosong: "[2222] Rincian", posita: "posita" } }));
    expect(hasil).toMatchObject({ bolehJalan: true, label: "Teliti" });
    expect(hasil.perkiraanRp).toBeGreaterThanOrEqual(1000);
    expect(klien.panggilan).toHaveLength(0);
    const c = await perkirakanPesan(db, pp, "", masukanDariBadan({ fitur: "C2", bahan: { perkara: "p", posita: "x", masukan: "mengabulkan" } })).catch((g) => g);
    expect(String(c.message ?? c)).toMatch(/hanya tersedia bagi hakim/);
  });

  it("ringkas memuat minimumRp, gratis, saldo satker (sisa pagu), dan fitur yang boleh per peran", async () => {
    const r = await ringkasAi(db, hakim);
    expect(r).toMatchObject({ minimumRp: 1000, gratis: false });
    expect(r.satker.batasRp).toBeGreaterThan(0);
    expect(r.satker.sisaRp).toBe(Math.max(0, r.satker.batasRp - r.satker.terpakaiRp));
    expect(r.fiturBlangko).toEqual(expect.arrayContaining(["A1", "A3", "B1", "D1", "D4", "C1", "C5"]));
    const rPp = await ringkasAi(db, pp);
    expect(rPp.fiturBlangko).toEqual(expect.arrayContaining(["A1", "A3", "B1", "D1", "D4"]));
    for (const k of ["C1", "C2", "C3", "C4"]) expect(rPp.fiturBlangko).not.toContain(k);
    const rSa = await ringkasAi(db, superAdmin);
    expect(rSa.gratis).toBe(true);
    // Tanpa batas satker dari Super Admin: sisa tidak ada (null), bukan nol.
    await simpanPengaturan(db, superAdmin.id, { batasSatkerBulananRp: 0 });
    expect((await ringkasAi(db, hakim)).satker).toMatchObject({ batasRp: 0, sisaRp: null });
    const tabel = tabelRuteDari(RUTE_BAWAAN);
    expect(fiturBlangkoBoleh(tabel, pp)).not.toContain("C1");
  });
});

// ─── 4. Menu proyek menurut konteks, panduan bergambar ───────────────────────

describe("menu proyek disaring menurut konteks perkara", () => {
  const labels = (a: Array<{ label: string }>) => a.map((x) => x.label);
  const menu = (konteks: { jenisBlangko?: string; jenisPerkara?: string; agenda?: string }) => muatModulAi().murni.saringMenu(RINGKAS_BAIK.pemicu, konteks);

  it("konteks 1 - blangko PUTUSAN perkara cerai: Peta/Duduk Perkara, pertimbangan, amar, saksi, kalkulator; sisanya hanya di Semua menu", () => {
    const m = menu({ jenisBlangko: "put", jenisPerkara: "Cerai Gugat" });
    expect(labels(m.utama)).toEqual(["Peta Perkara", "Duduk Perkara", "Pertimbangan / PT", "Amar Putusan", "Keterangan Saksi", "Kalkulator Nafkah"]);
    expect(labels(m.semua)).toHaveLength(8);
  });

  it("konteks 2 - BAS sidang PEMBUKTIAN: saksi dan panduan sidang tampil, pertimbangan/amar tidak", () => {
    const m = menu({ jenisBlangko: "bas", jenisPerkara: "Cerai Gugat", agenda: "Pembuktian saksi" });
    expect(labels(m.utama)).toEqual(["Peta Perkara", "Duduk Perkara", "Keterangan Saksi", "Panduan Sidang", "Kalkulator Nafkah"]);
    expect(labels(m.utama)).not.toContain("Amar Putusan");
  });

  it("konteks 3 - BAS sidang mediasi, perkara bukan cerai: hanya Peta/Duduk Perkara dan panduan sidang", () => {
    const m = menu({ jenisBlangko: "bas", jenisPerkara: "Izin Poligami", agenda: "Mediasi" });
    expect(labels(m.utama)).toEqual(["Peta Perkara", "Duduk Perkara", "Panduan Sidang"]);
    expect(labels(m.semua)).toContain("Kalkulator Nafkah");
    // Belum ada blangko dipilih: sama dengan sidang umum.
    expect(labels(menu({ jenisBlangko: "", jenisPerkara: "Izin Poligami" }).utama)).toEqual(["Peta Perkara", "Duduk Perkara", "Panduan Sidang"]);
  });
});

describe("panel: menu proyek dan panduan bergambar", () => {
  const hidup = { "blangkoDerryAi:usr-1": true };

  it("Menu proyek tampil di bilah; isinya tersaring menurut konteks; Semua menu membuka semuanya", async () => {
    const h = bukaPanel({ simpanan: hidup, konteks: { jenisBlangko: "bas", jenisPerkara: "Izin Poligami", agenda: "Mediasi" } });
    await sampai(() => !h.q("#bd-ai-bilah")!.hasAttribute("hidden"), "bilah");
    h.q<HTMLButtonElement>('[data-ai-grup="Menu proyek"]')!.click();
    expect([...h.akarEl.querySelectorAll("[data-ai-menu]")].map((x) => x.textContent)).toEqual(["Peta Perkara", "Duduk Perkara", "Panduan Sidang"]);
    h.q<HTMLButtonElement>("[data-ai-semua]")!.click();
    expect(h.akarEl.querySelectorAll("[data-ai-menu]")).toHaveLength(8);
  });

  it("klik menu: pemicu proyek dikirim dengan data perkara (bahan), perkiraan tampil dulu, hasil = usulan bertanda", async () => {
    const h = bukaPanel({ simpanan: hidup, konteks: { jenisBlangko: "put", jenisPerkara: "Cerai Gugat" }, hasil: () => "Duduk perkara: Bahwa Penggugat ..." });
    await sampai(() => !h.q("#bd-ai-bilah")!.hasAttribute("hidden"), "bilah");
    h.q<HTMLButtonElement>('[data-ai-grup="Menu proyek"]')!.click();
    h.q<HTMLButtonElement>('[data-ai-menu="duduk-perkara"]')!.click();
    await sampai(() => /Perkiraan biaya: sekitar Rp1\.500/.test(h.q("#bd-ai-kendali")?.textContent ?? ""), "perkiraan");
    expect(h.panggilan.some((p) => p.alamat.endsWith("/pesan"))).toBe(false);
    h.q<HTMLButtonElement>('[data-ai="jalan"]')!.click();
    await sampai(() => h.q("#bd-ai-hasil .bd-ai-tanda"), "hasil");
    const perkiraan = h.panggilan.find((p) => p.alamat.endsWith("/perkiraan"))!.badan;
    const pesan = h.panggilan.find((p) => p.alamat.endsWith("/pesan"))!.badan;
    for (const b of [perkiraan, pesan]) {
      expect(b.pemicu).toBe("duduk-perkara");
      expect(b.fitur).toBeUndefined();
      expect(Object.keys(b.bahan)).toEqual(expect.arrayContaining(["perkara", "sidang", "posita", "samarkan"]));
    }
    expect(h.terapan).toHaveLength(0);
  });

  it("tanpa perkara dibuka: tombol menu mati; saklar MATI: tidak ada menu sama sekali", async () => {
    const h = bukaPanel({ simpanan: hidup, perkara: false });
    await sampai(() => !h.q("#bd-ai-bilah")!.hasAttribute("hidden"), "bilah");
    expect(h.q<HTMLButtonElement>('[data-ai-grup="Menu proyek"]')!.disabled).toBe(true);
    const mati = bukaPanel();
    await sampai(() => mati.ai().keadaan().ringkas, "ringkas");
    expect(mati.q("[data-ai-menu]")).toBeNull();
    expect(mati.q("[data-ai-grup]")).toBeNull();
  });

  it("panduan: tampil SEKALI saat saklar pertama dinyalakan (menyorot elemen nyata), 7 langkah; tidak muncul lagi; dibuka lewat (?)", async () => {
    const h = bukaPanel();
    await sampai(() => h.ai().keadaan().ringkas && !h.q("#bd-ai-saklar")!.hasAttribute("hidden"), "tampil");
    expect(h.ai().turTerbuka()).toBe(-1);
    expect(Object.keys(h.simpanan).some((k) => k.startsWith("blangkoDerryAiTur"))).toBe(false); // MATI = tanpa jejak
    sakelar(h).checked = true;
    sakelar(h).dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => h.q("#bd-ai-tur"), "panduan tampil");
    expect(h.simpanan["blangkoDerryAiTur:usr-1"]).toBe(true);
    expect(h.q("#bd-ai-kartu-tur")!.textContent).toMatch(/Langkah 1 dari 7.*Saklar ALETA Ai/);
    expect(h.q("#bd-ai-sorot")!.hasAttribute("hidden")).toBe(false); // elemen nyata disorot
    const judul: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      judul.push(h.q("#bd-ai-kartu-tur b")!.textContent!);
      h.q<HTMLButtonElement>('[data-tur="maju"], [data-tur="selesai"]')!.click();
    }
    expect(judul).toEqual(["Saklar ALETA Ai", "Saldo Anda", "Pilihan bantuan", "Menu proyek", "Biaya tampil dulu", "Hasilnya berupa usulan", "Terima atau tolak"]);
    expect(h.q("#bd-ai-tur")).toBeNull(); // Selesai menutup
    // Dimatikan lalu dinyalakan lagi: tidak muncul untuk kedua kalinya.
    sakelar(h).checked = false;
    sakelar(h).dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => h.simpanan["blangkoDerryAi:usr-1"] === false, "mati");
    sakelar(h).checked = true;
    sakelar(h).dispatchEvent(new h.w.Event("change", { bubbles: true }));
    await sampai(() => h.simpanan["blangkoDerryAi:usr-1"] === true, "nyala lagi");
    await tunggu(30);
    expect(h.q("#bd-ai-tur")).toBeNull();
    // Dibuka lagi lewat tanda (?).
    h.q<HTMLButtonElement>("[data-ai-tur]")!.click();
    expect(h.q("#bd-ai-tur")).not.toBeNull();
    expect(h.ai().turTerbuka()).toBe(0);
    h.q<HTMLButtonElement>('[data-tur="lewati"]')!.click();
    expect(h.q("#bd-ai-tur")).toBeNull();
  });

  it("panduan tidak muncul bila akun sudah pernah melihatnya", async () => {
    const h = bukaPanel({ simpanan: { "blangkoDerryAi:usr-1": true, "blangkoDerryAiTur:usr-1": true } });
    await sampai(() => !h.q("#bd-ai-bilah")!.hasAttribute("hidden"), "bilah");
    await tunggu(30);
    expect(h.q("#bd-ai-tur")).toBeNull();
  });
});

describe("server: menu proyek (pemicu) memakai jalur lama dengan data tersamar", () => {
  it("masukanDariBadan: pemicu + bahan -> pemicu dipertahankan, data jadi teks DATA, daftar samaran ikut; tanpa perkara = 400", () => {
    const m = masukanDariBadan({ pemicu: "duduk-perkara", teks: "fokus pada posita", bahan: { perkara: "Nomor perkara: 1/Pdt.G/2026/PA.Dgl", posita: "Bahwa Penggugat ...", samarkan: [{ jenis: "NAMA", nilai: "Siti" }] } });
    expect(m.pemicu).toBe("duduk-perkara");
    expect(m.kelompok).toBeUndefined();
    expect(m.teks).toContain("Catatan petugas: fokus pada posita");
    expect(m.teks).toContain("=== POSITA / GUGATAN ===");
    expect(m.samarkan).toEqual([{ jenis: "NAMA", nilai: "Siti" }]);
    expect(() => masukanDariBadan({ pemicu: "duduk-perkara", bahan: {} })).toThrow(/data perkara/);
    // Tanpa bahan: bentuk lama persis.
    expect(masukanDariBadan({ pemicu: "duduk-perkara", teks: "" })).toEqual({ teks: "", pemicu: "duduk-perkara" });
  });
});
