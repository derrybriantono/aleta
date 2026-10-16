// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { newDb } from "pg-mem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LANGKAH_KONSEPTOR,
  kelompokkanIsian,
  langkahUntukIsian,
  nilaiKemajuan,
  ringkasKemajuan,
  teksKesiapan,
  type KemajuanKonseptor,
} from "@/lib/konseptor-langkah";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_KONSEPTOR_LANGKAH } from "@/server/db/schema";
import {
  bacaKemajuanKonseptor,
  bacaRingkasKemajuan,
  simpanLaporBlangko,
  simpanTandaLangkah,
} from "@/server/modules/aleta-ecourt/konseptor-langkah";

/**
 * ============================================================================
 * CHECKLIST KONSEPTOR SEMENTARA (F1.6, 17 Okt 2026)
 * ============================================================================
 *
 * Yang dijaga:
 *   1. migrasi 0067 (idx 64): berkas = schema.ts, jurnal tanpa lubang, ikut
 *      cadangan mode ingatan;
 *   2. aturan: isian Blangko Derry yang kosong MENGALAHKAN centang; blangko
 *      yang terisi penuh menyelesaikan langkahnya sendiri; "koreksi majelis"
 *      hanya lewat centang; siap = semua langkah selesai;
 *   3. penyimpanan: siapa & kapan per langkah, laporan blangko menimpa;
 *   4. rute: membaca boleh panel, menulis hanya penyusun draf (putusan.draf);
 *      GET konseptor-sementara membawa ringkasan kemajuan;
 *   5. ekstensi: konseptor-langkah.js melapor blangko PUTUSAN sekali per
 *      perubahan (bukan BAS), kartu centang memanggil rute; Blangko Derry
 *      mengumumkan "aleta-bd-isian" dan alatnya terdaftar di manifest.
 */

const AKAR = process.cwd();
const EKSTENSI = path.resolve(AKAR, "..", "ekstensi-sipp");

const pernyataan = (sql: string) =>
  sql
    .split("\n")
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

// ─── 1. Migrasi ──────────────────────────────────────────────────────────────

describe("migrasi 0067 - diklaim sekali, DDL berkas = schema.ts", () => {
  const SQL = path.join(AKAR, "drizzle", "0067_aleta_konseptor_langkah.sql");

  it("jurnal: 0067 di idx 64 sekali, tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(AKAR, "drizzle/meta/_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0067_"))).toEqual([
      expect.objectContaining({ idx: 64, tag: "0067_aleta_konseptor_langkah" }),
    ]);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i].when).toBeGreaterThan(j.entries[i - 1].when);
    expect(existsSync(SQL)).toBe(true);
  });

  it("pernyataan berkas = DDL_KONSEPTOR_LANGKAH, berjalan di pg-mem, ikut cadangan mode ingatan", () => {
    expect(pernyataan(readFileSync(SQL, "utf8"))).toEqual(DDL_KONSEPTOR_LANGKAH.tabel.map((s) => pernyataan(s)[0]));
    // Sekali saja: pg-mem tidak sanggup mengulang CREATE TABLE IF NOT EXISTS
    // berkunci gabungan (batas pg-mem, bukan Postgres).
    const kosong = newDb();
    kosong.public.none(readFileSync(SQL, "utf8"));
    expect(kosong.public.many("SELECT perkara_id FROM aleta_konseptor_langkah")).toEqual([]);
    expect(kosong.public.many("SELECT perkara_id FROM aleta_konseptor_blangko")).toEqual([]);
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_konseptor_langkah");
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_konseptor_blangko");
  });
});

// ─── 2. Aturan ───────────────────────────────────────────────────────────────

describe("isian blangko -> langkah", () => {
  it("kode yang dikenal, tanya jawab saksi, bukti, dan kata pada nama", () => {
    expect(langkahUntukIsian({ kode: "8436", nama: "Kesimpulan Penggugat" })).toBe("kesimpulan");
    expect(langkahUntukIsian({ kode: "1214", nama: "Alat bukti surat Penggugat", khusus: "bukti" })).toBe("bukti");
    expect(langkahUntukIsian({ kode: "9001", nama: "Saksi 1 Penggugat", jenis: "tj" })).toBe("saksi");
    expect(langkahUntukIsian({ kode: "8503", nama: "Alasan perceraian" })).toBe("pertimbangan");
    expect(langkahUntukIsian({ kode: "8729", nama: "Penilaian keterangan saksi dan fakta" })).toBe("pertimbangan");
    expect(langkahUntukIsian({ kode: "8901", nama: "Amar kesepakatan" })).toBe("amar");
    expect(langkahUntukIsian({ kode: "5230", nama: "Ongkos panggilan" })).toBe("biaya");
    expect(langkahUntukIsian({ kode: "9999", nama: "Petitum tambahan" })).toBe("amar");
    // Keadaan perkara (awal perselisihan, pisah rumah, kuasa) dirangkum di duduk perkara.
    expect(langkahUntukIsian({ kode: "0222", nama: "Awal perselisihan" })).toBe("duduk");
    expect(langkahUntukIsian({ kode: "0156", nama: "Nama kantor advokat Penggugat" })).toBe("duduk");
  });

  it("katalog: delapan langkah, koreksi majelis tanpa isian blangko", () => {
    expect(LANGKAH_KONSEPTOR.map((l) => l.kode)).toEqual(["duduk", "bukti", "saksi", "kesimpulan", "pertimbangan", "amar", "biaya", "koreksi"]);
    expect(LANGKAH_KONSEPTOR.find((l) => l.kode === "koreksi")!.dariBlangko).toBe(false);
  });
});

describe("nilaiKemajuan - blangko kosong mengalahkan centang", () => {
  const PADA = "2026-10-17T00:10:00.000Z";
  const blangko = (isian: Parameters<typeof kelompokkanIsian>[0]) => ({
    berkas: "[01] Putusan Kontradiktoir",
    terisi: isian.filter((b) => b.terisi).length,
    jumlah: isian.length,
    perLangkah: kelompokkanIsian(isian),
    oleh: "Hakim Fulan",
    pada: PADA,
  });

  it("dicentang tetapi isian kesimpulan masih kosong: BELUM selesai, nama isiannya disebut", () => {
    const k = nilaiKemajuan(
      { kesimpulan: { selesai: true, oleh: "PP Ani", pada: PADA, catatan: "" } },
      blangko([
        { kode: "8436", nama: "Kesimpulan Penggugat", terisi: true },
        { kode: "8437", nama: "Kesimpulan Tergugat", terisi: false },
      ])
    );
    const l = k.langkah.find((x) => x.kode === "kesimpulan")!;
    expect(l.status).toBe("kosong");
    expect(l.dicentang).toBe(true);
    expect(l.blangko).toEqual({ jumlah: 2, terisi: 1, kosong: ["Kesimpulan Tergugat"] });
    expect(k.siap).toBe(false);
  });

  it("isian blangko langkah itu terisi semua: selesai dari blangko tanpa centang (siapa = pelapor blangko)", () => {
    const k = nilaiKemajuan({}, blangko([{ kode: "1214", nama: "Alat bukti surat Penggugat", khusus: "bukti", terisi: true }]));
    const l = k.langkah.find((x) => x.kode === "bukti")!;
    expect(l).toMatchObject({ status: "selesai", sumber: "blangko", oleh: "Hakim Fulan", pada: PADA, dicentang: false });
    // Langkah tanpa isian blangko tidak ikut selesai sendiri.
    expect(k.langkah.find((x) => x.kode === "amar")!.status).toBe("belum");
  });

  it("siap dibacakan hanya bila SEMUA langkah selesai - termasuk koreksi majelis", () => {
    const semua = Object.fromEntries(LANGKAH_KONSEPTOR.map((l) => [l.kode, { selesai: true, oleh: "x", pada: PADA, catatan: "" }]));
    expect(nilaiKemajuan(semua, null).siap).toBe(true);
    const tanpaKoreksi = { ...semua, koreksi: { selesai: false, oleh: "Ketua", pada: PADA, catatan: "" } };
    const k = nilaiKemajuan(tanpaKoreksi, null);
    expect(k.siap).toBe(false);
    const r = ringkasKemajuan(k);
    expect(r).toMatchObject({ selesai: 7, jumlah: 8, belum: ["Dikoreksi majelis"], adaBlangko: false });
    expect(teksKesiapan(r)).toBe("Draf 7/8 langkah");
    expect(teksKesiapan(ringkasKemajuan(nilaiKemajuan(semua, null)))).toBe("Draf siap dibacakan");
  });
});

// ─── 3-4. Penyimpanan dan rute ───────────────────────────────────────────────

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-hakim";

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", async (asli) => {
  const modul = await asli<typeof import("@/server/shared/auth")>();
  return { ...modul, resolveActorUserId: async () => aktor };
});

type Hasil = { status: number; isi: { ok: boolean; data: Record<string, unknown>; error?: { message: string } } };
async function rute(alamat: string, cara: "GET" | "POST", badan?: unknown): Promise<Hasil> {
  const modul = (alamat.startsWith("/api/aleta-ecourt/konseptor-sementara")
    ? await import("@/app/api/aleta-ecourt/konseptor-sementara/route")
    : await import("@/app/api/aleta-ecourt/konseptor-langkah/route")) as unknown as Record<string, (r: NextRequest) => Promise<Response>>;
  const req = new NextRequest(`http://localhost${alamat}`, {
    method: cara,
    headers: badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: badan !== undefined ? JSON.stringify(badan) : undefined,
  });
  const j = await modul[cara](req);
  return { status: j.status, isi: (await j.json()) as Hasil["isi"] };
}

describe("penyimpanan dan rute (pg-mem berbenih)", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-hakim";
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("centang menyimpan siapa & kapan; mencabut juga tercatat; langkah asing ditolak", async () => {
    expect(await simpanTandaLangkah(db!, { perkaraId: "581", langkah: "amar", selesai: true, oleh: "Hakim A" })).toEqual({ ok: true, alasan: "" });
    let k = (await bacaKemajuanKonseptor(db!, ["581"]))["581"];
    expect(k.langkah.find((l) => l.kode === "amar")).toMatchObject({ status: "selesai", sumber: "tangan", oleh: "Hakim A" });
    await simpanTandaLangkah(db!, { perkaraId: "581", langkah: "amar", selesai: false, oleh: "Hakim B" });
    k = (await bacaKemajuanKonseptor(db!, ["581"]))["581"];
    expect(k.langkah.find((l) => l.kode === "amar")).toMatchObject({ status: "belum", dicentang: false, oleh: "Hakim B" });
    expect((await simpanTandaLangkah(db!, { perkaraId: "581", langkah: "hapus", selesai: true, oleh: "x" })).ok).toBe(false);
    // Perkara tanpa apa pun tetap diberi kemajuan kosong.
    expect((await bacaRingkasKemajuan(db!, ["999"]))["999"]).toMatchObject({ selesai: 0, jumlah: 8, siap: false });
  });

  it("laporan blangko menimpa yang lama dan menyebut isian kosong per langkah", async () => {
    await simpanLaporBlangko(db!, {
      perkaraId: "581",
      berkas: "lama",
      isian: [{ kode: "8436", nama: "Kesimpulan Penggugat", terisi: false }],
      oleh: "Hakim A",
    });
    await simpanLaporBlangko(db!, {
      perkaraId: "581",
      nomorPerkara: "581/Pdt.G/2026/PA.Dgl",
      berkas: "[01] Putusan",
      isian: [
        { kode: "8436", nama: "Kesimpulan Penggugat", terisi: true },
        { kode: "8437", nama: "Kesimpulan Tergugat", terisi: false },
        { kode: "1214", nama: "Alat bukti surat Penggugat", khusus: "bukti", terisi: true },
      ],
      oleh: "Hakim A",
    });
    const k = (await bacaKemajuanKonseptor(db!, ["581"]))["581"];
    expect(k.blangko).toMatchObject({ berkas: "[01] Putusan", terisi: 2, jumlah: 3, oleh: "Hakim A" });
    expect(k.langkah.find((l) => l.kode === "kesimpulan")!.blangko!.kosong).toEqual(["Kesimpulan Tergugat"]);
    expect(k.langkah.find((l) => l.kode === "bukti")!.status).toBe("selesai");
    expect((await simpanLaporBlangko(db!, { perkaraId: "581", isian: [], oleh: "x" })).ok).toBe(false);
  });

  it("rute: hakim mencentang; juru sita hanya membaca (403 saat menulis)", async () => {
    const tulis = await rute("/api/aleta-ecourt/konseptor-langkah", "POST", { perkaraId: "581", langkah: "duduk", selesai: true });
    expect(tulis.status).toBe(200);
    const kemajuan = tulis.isi.data.kemajuan as KemajuanKonseptor;
    expect(kemajuan.langkah[0]).toMatchObject({ kode: "duduk", status: "selesai", oleh: "Hj. Nur Aisyah" });

    aktor = "usr-jurusita";
    const ditolak = await rute("/api/aleta-ecourt/konseptor-langkah", "POST", { perkaraId: "581", langkah: "amar", selesai: true });
    expect(ditolak.status).toBe(403);
    const lapor = await rute("/api/aleta-ecourt/konseptor-langkah", "POST", {
      perkaraId: "581",
      lapor: { berkas: "x", isian: [{ kode: "8436", nama: "Kesimpulan", terisi: false }] },
    });
    expect(lapor.status).toBe(403);

    aktor = "usr-hakim";
    const baca = await rute("/api/aleta-ecourt/konseptor-langkah?perkaraId=581", "GET");
    expect(baca.status).toBe(200);
    const peta = baca.isi.data.peta as Record<string, KemajuanKonseptor>;
    expect(peta["581"].selesai).toBe(1);
  });

  it("GET konseptor-sementara membawa ringkasan kemajuan pada perkara yang punya tunjukan saja", async () => {
    aktor = "usr-ketua";
    expect((await rute("/api/aleta-ecourt/konseptor-sementara", "POST", { perkaraId: "581", nomorPerkara: "581/Pdt.G/2026/PA.Dgl", nama: "Hj. Nur Aisyah" })).status).toBe(200);
    await simpanTandaLangkah(db!, { perkaraId: "581", langkah: "koreksi", selesai: true, oleh: "Ketua" });
    const r = await rute("/api/aleta-ecourt/konseptor-sementara?perkaraId=581,582", "GET");
    const peta = r.isi.data.peta as Record<string, { nama: string; kemajuan?: { selesai: number; jumlah: number; belum: string[] } }>;
    expect(peta["581"].nama).toBe("Hj. Nur Aisyah");
    expect(peta["581"].kemajuan).toMatchObject({ selesai: 1, jumlah: 8 });
    expect(peta["581"].kemajuan!.belum).not.toContain("Dikoreksi majelis");
    expect(peta["582"]).toBeUndefined();
  });
});

// ─── 5. Ekstensi ─────────────────────────────────────────────────────────────

describe("ekstensi: konseptor-langkah.js di ABT", () => {
  const SUMBER = readFileSync(path.join(EKSTENSI, "konseptor-langkah.js"), "utf8");
  let alat: Map<string, () => void>;
  let panggilan: Array<{ url: string; method: string; body: Record<string, unknown> | null }>;

  const KEMAJUAN = nilaiKemajuan({ amar: { selesai: true, oleh: "Hakim A", pada: "2026-10-17T00:10:00.000Z", catatan: "" } }, null);

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div id="aleta-bd-akar"></div>`;
    alat = new Map();
    panggilan = [];
    const g = globalThis as Record<string, unknown>;
    delete g.aletaKonseptorLangkah;
    g.aletaBlangkoDerry = {
      daftarkanAlat: (id: string, fn: () => void) => alat.set(id, fn),
      perkaraTerpilih: () => ({ perkara: { perkaraId: "581", nomorPerkara: "581/Pdt.G/2026/PA.Dgl" } }),
    };
    g.fetch = vi.fn(async (url: string, opsi: { method?: string; body?: string } = {}) => {
      panggilan.push({ url, method: opsi.method || "GET", body: opsi.body ? JSON.parse(opsi.body) : null });
      const data = opsi.method === "POST" ? { ok: true, alasan: "", kemajuan: KEMAJUAN } : { ada: true, peta: { "581": KEMAJUAN } };
      return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { "content-type": "application/json" } });
    });
    new Function(SUMBER)();
  });
  afterEach(() => {
    vi.useRealTimers();
    const g = globalThis as Record<string, unknown>;
    delete g.aletaBlangkoDerry;
    delete g.aletaKonseptorLangkah;
  });

  const umumkan = (detail: Record<string, unknown>) => document.dispatchEvent(new CustomEvent("aleta-bd-isian", { detail }));
  const ISIAN = [
    { kode: "8436", nama: "Kesimpulan Penggugat", jenis: "teks", khusus: "", terisi: true },
    { kode: "8437", nama: "Kesimpulan Tergugat", jenis: "teks", khusus: "", terisi: false },
  ];

  it("blangko putusan dilapor sekali sesudah jeda; yang sama tidak dikirim ulang; BAS tidak dilapor", async () => {
    expect(alat.has("konseptor")).toBe(true);
    umumkan({ perkaraId: "581", nomorPerkara: "581/Pdt.G/2026/PA.Dgl", jenis: "put", berkas: "[01] Putusan", isian: ISIAN });
    umumkan({ perkaraId: "581", nomorPerkara: "581/Pdt.G/2026/PA.Dgl", jenis: "put", berkas: "[01] Putusan", isian: ISIAN });
    await vi.advanceTimersByTimeAsync(4100);
    expect(panggilan).toHaveLength(1);
    expect(panggilan[0]).toMatchObject({ url: "/aleta/api/aleta-ecourt/konseptor-langkah", method: "POST" });
    expect(panggilan[0].body).toMatchObject({ perkaraId: "581", lapor: { berkas: "[01] Putusan", isian: ISIAN } });

    umumkan({ perkaraId: "581", nomorPerkara: "581/Pdt.G/2026/PA.Dgl", jenis: "put", berkas: "[01] Putusan", isian: ISIAN });
    await vi.advanceTimersByTimeAsync(4100);
    expect(panggilan).toHaveLength(1);

    umumkan({ perkaraId: "581", jenis: "bas", berkas: "BAS", isian: ISIAN });
    await vi.advanceTimersByTimeAsync(4100);
    expect(panggilan).toHaveLength(1);
  });

  it("alat Checklist konseptor membuka kartu dari rute GET dan centang dikirim ke rute", async () => {
    alat.get("konseptor")!();
    await vi.advanceTimersByTimeAsync(0);
    const kartu = document.getElementById("bd-konseptor")!;
    expect(kartu.hidden).toBe(false);
    expect(panggilan[0]).toMatchObject({ url: "/aleta/api/aleta-ecourt/konseptor-langkah?perkaraId=581", method: "GET" });
    expect(kartu.querySelectorAll("[data-langkah]")).toHaveLength(8);
    expect(kartu.querySelector('[data-langkah="amar"]')!.getAttribute("data-status")).toBe("selesai");
    expect(kartu.textContent).toContain("Hakim A");

    const kotak = kartu.querySelector('[data-kl-langkah="duduk"]') as HTMLInputElement;
    kotak.checked = true;
    kotak.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(0);
    expect(panggilan.at(-1)).toMatchObject({ method: "POST", body: { perkaraId: "581", langkah: "duduk", selesai: true } });
  });
});

describe("Blangko Derry tersambung (berkas bersama, perubahan kecil)", () => {
  it("blangko-derry-isian.js mengumumkan aleta-bd-isian dari laporKeKerangka beserta terisi/kosong tiap isian", () => {
    const isi = readFileSync(path.join(EKSTENSI, "blangko-derry-isian.js"), "utf8");
    const lapor = isi.slice(isi.indexOf("function laporKeKerangka()"), isi.indexOf("// Menyimpan satu isian ke ABT"));
    expect(lapor).toContain('new CustomEvent("aleta-bd-isian"');
    expect(lapor).toContain("terisi: y > 0 && x >= y");
  });

  it("alat 'konseptor' ada di menu hakim dan PP; skripnya dimuat sesudah blangko-derry-isian.js dan ikut tanam", () => {
    const kerangka = readFileSync(path.join(EKSTENSI, "blangko-derry.js"), "utf8");
    expect(kerangka.match(/\["konseptor", "Checklist konseptor putusan"\]/g)).toHaveLength(2);
    const m = JSON.parse(readFileSync(path.join(EKSTENSI, "manifest.json"), "utf8")) as { content_scripts: Array<{ js?: string[] }> };
    const abt = m.content_scripts.find((x) => (x.js || []).includes("blangko-derry-isian.js"))!.js!;
    expect(abt.indexOf("konseptor-langkah.js")).toBe(abt.indexOf("blangko-derry-isian.js") + 1);
    expect(readFileSync(path.join(AKAR, "scripts", "susun-ekstensi.mjs"), "utf8")).toContain('"konseptor-langkah.js"');
  });
});
