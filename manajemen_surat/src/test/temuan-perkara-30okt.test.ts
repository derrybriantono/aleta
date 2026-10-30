// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * G4 (30 Okt 2026) - ekstensi temuan-perkara.js di panel cetak Blangko Derry.
 *   - kehadiran menurut nama BAS sama persis dengan bot (satu aturan di dua tempat);
 *   - BAS berbeda dari SIPP / verstek: usulan disebut; tombol "Betulkan di SIPP" HANYA bila server menyatakan
 *     penekan = PP perkara; satu klik mengirim semua usulan (POST per sidang) lalu menyebut yang sudah dibetulkan;
 *   - bukan PP: tanpa tombol;
 *   - putusan SIPP vs dokumen beda: peringatan pasif tanpa tombol;
 *   - berkas terdaftar di manifest dan daftar susun ekstensi; blangko-derry-isian memanggilnya dari wadah yang sama.
 */

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const bot = require_(path.join(AKAR, "aleta_bot/services/kehadiranSidangTulisService.js")) as Record<string, any>;

type Modul = { gambar: (w: HTMLElement, k: Record<string, unknown>) => void; kehadiranBas: (n: string) => number | null; _lupakan: () => void };
let M: Modul;

beforeAll(() => {
  // eslint-disable-next-line no-new-func
  new Function(readFileSync(path.join(AKAR, "ekstensi-sipp/temuan-perkara.js"), "utf8"))();
  M = (globalThis as unknown as { AletaTemuanPerkara: Modul }).AletaTemuanPerkara;
});

afterEach(() => {
  vi.unstubAllGlobals();
  M._lupakan();
  document.body.innerHTML = "";
});

const tunggu = () => new Promise((r) => setTimeout(r, 30));

function tiruPortal(jawab: (url: string, badan: any) => unknown) {
  const kiriman: Array<{ url: string; badan: any }> = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const badan = init?.body ? JSON.parse(String(init.body)) : null;
    kiriman.push({ url: String(url), badan });
    return new Response(JSON.stringify({ ok: true, data: jawab(String(url), badan) }), { status: 200, headers: { "content-type": "application/json" } });
  });
  return kiriman;
}

const NAMA_BAS = [
  "[1] BAS 1 P & T Hadir - Mediasi.rtf",
  "[1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T.rtf",
  "[T] BAS P & T Tidak Hadir - Tunda Panggil P & T (kapan saja).rtf",
  "[3] BAS Putus P & T Tidak Hadir - Gugur.rtf",
  "[2] BAS 2 P & T Hadir - Laporan Mediasi dan Pemeriksaan Pokok Perkara.rtf",
  "[1] BAS Ikrar Talak.rtf",
  "[01] [Kabul Verstek] Cerai (Format Lengkap).rtf",
];

describe("temuan-perkara.js", () => {
  it("kehadiran dari nama BAS = aturan bot", () => {
    for (const n of NAMA_BAS) expect(M.kehadiranBas(n), n).toBe(bot.kehadiranBas(n));
  });

  it("BAS P & T hadir, SIPP Penggugat saja, penekan PP: satu tombol menulis lalu menyebut yang dibetulkan", async () => {
    const kiriman = tiruPortal((url, badan) =>
      badan
        ? { ok: true, kalimat: "ok" }
        : { ok: true, bolehAnda: true, pp: { username: "qadariyah", namaLengkap: "Qadariyah, S.H." }, usul: [{ jadwalId: 50, urutan: 3, tanggal: "2026-10-30", dari: 2, ke: 1, sebab: "bas" }], bertentangan: [] }
    );
    const w = document.createElement("div");
    document.body.appendChild(w);
    M.gambar(w, { perkaraId: "10180", jenis: "bas", berkas: NAMA_BAS[0], jenisPerkara: "Cerai Gugat", sidang: { sidangId: "50", hadir: 2 }, temuanVerstek: false });
    await tunggu();
    expect(kiriman[0].url).toContain("/aleta/api/aleta-ecourt/kehadiran-sidang?perkaraId=10180&basJadwalId=50&basNama=");
    expect(w.textContent).toContain("BAS sidang ini mencatat Semua Pihak, sedangkan SIPP mencatat Penggugat saja");
    expect(w.textContent).toContain("sidang ke-3 (30 Oktober 2026): Penggugat saja menjadi Semua Pihak");
    const tombol = w.querySelector('[data-temuan="betulkan"]') as HTMLButtonElement;
    expect(tombol).toBeTruthy();
    tombol.click();
    await tunggu();
    await tunggu();
    const tulis = kiriman.filter((k) => k.badan);
    expect(tulis).toEqual([{ url: "/aleta/api/aleta-ecourt/kehadiran-sidang", badan: { perkaraId: "10180", jadwalId: "50", dihadiriOleh: 1, sebelum: 2, sebab: "bas" } }]);
    expect(w.textContent).toContain("Sudah dibetulkan di SIPP: sidang ke-3 (30 Oktober 2026)");
    expect(w.querySelector('[data-temuan="betulkan"]')).toBeNull();
  });

  it("bukan PP perkara: usulan disebut tanpa tombol", async () => {
    tiruPortal(() => ({ ok: true, bolehAnda: false, pp: { username: "qadariyah", namaLengkap: "Qadariyah, S.H." }, usul: [{ jadwalId: 17850, urutan: 1, tanggal: "2025-11-06", dari: 1, ke: 2, sebab: "verstek" }] }));
    const w = document.createElement("div");
    document.body.appendChild(w);
    M.gambar(w, { perkaraId: "9222", jenis: "put", berkas: "x", jenisPerkara: "Cerai Gugat", sidang: null, temuanVerstek: true });
    await tunggu();
    expect(w.textContent).toContain("Semua Pihak menjadi Penggugat saja");
    expect(w.textContent).toContain("Dibetulkan panitera pengganti perkara ini (Qadariyah, S.H.)");
    expect(w.querySelector("button")).toBeNull();
  });

  it("tanpa temuan verstek dan BAS sama dengan SIPP: tidak bertanya ke server", async () => {
    const kiriman = tiruPortal(() => ({}));
    const w = document.createElement("div");
    M.gambar(w, { perkaraId: "1", jenis: "bas", berkas: NAMA_BAS[1], sidang: { sidangId: "9", hadir: 2 }, temuanVerstek: false });
    await tunggu();
    expect(kiriman).toHaveLength(0);
    expect(w.textContent).toBe("");
  });

  it("putusan SIPP vs dokumen beda: peringatan pasif", async () => {
    tiruPortal((url) => (url.includes("cocok-putusan") ? { keadaan: "beda", beda: [{ label: "Tanggal putusan", ringkas: "tanggal putusan berbeda", sipp: "27 Oktober 2026", dokumen: "28 Oktober 2026" }] } : {}));
    const w = document.createElement("div");
    document.body.appendChild(w);
    M.gambar(w, { perkaraId: "10185", jenis: "put", berkas: "x", putusanSipp: { tanggalPutusan: "2026-10-27", amarVerstek: false }, temuanVerstek: false });
    await tunggu();
    expect(w.textContent).toContain("putusan di SIPP berbeda dengan dokumen putusan yang diunggah - tanggal putusan berbeda");
    expect(w.querySelector("button")).toBeNull();
  });

  it("terdaftar di manifest + susun ekstensi; dipanggil dari wadah catatan temuan", () => {
    const manifest = readFileSync(path.join(AKAR, "ekstensi-sipp/manifest.json"), "utf8");
    const susun = readFileSync(path.join(AKAR, "manajemen_surat/scripts/susun-ekstensi.mjs"), "utf8");
    expect(manifest).toContain('"temuan-perkara.js"');
    expect(susun).toContain('"temuan-perkara.js"');
    const isian = readFileSync(path.join(AKAR, "ekstensi-sipp/blangko-derry-isian.js"), "utf8");
    expect(isian).toMatch(/globalThis\.AletaTemuanPerkara[\s\S]{0,200}U\.gambar\(e,/);
    expect(readFileSync(path.join(AKAR, "ekstensi-sipp/temuan-perkara.js"), "utf8")).not.toMatch(/\b(aleta)\b[^/]*sipp\b.*innerHTML/i);
  });
});
