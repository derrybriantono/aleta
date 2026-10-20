// @vitest-environment node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * BEBAN PENETAPAN: SATU SUMBER ANGKA, SK, DAN TAMPILAN SAMA DI PAPAN & PANEL SIPP
 * (20 Okt 2026, agen B1)
 * ============================================================================
 *
 * Perhitungan (30 hari, kebendaan 6 bulan, persen, skor, urutan, kesesuaian SK)
 * dibuktikan oleh aleta_bot/scripts/verify-beban-penetapan.js atas SIPP tiruan.
 * Di sini: skrip itu dijalankan, blok tampilannya digambar di jsdom dari objek
 * usulan.statistik, dan kabel ke papan (konten.js) dan panel (penetapan-sipp.js)
 * dijaga.
 */

const AKAR = path.resolve(process.cwd(), "..");
const baca = (p: string) => readFileSync(path.join(AKAR, p), "utf8");

type Modul = { tempelDi: (w: Element, u: unknown, o?: unknown) => Element | null };

describe("perhitungan beban di bot", () => {
  it("skrip verifikasi bot lulus seluruhnya (statistik, skor, urutan, SK, hanya SELECT)", () => {
    const hasil = spawnSync(process.execPath, ["aleta_bot/scripts/verify-beban-penetapan.js"], {
      cwd: AKAR,
      encoding: "utf8",
      env: { ...process.env, TMP: "D:\\Aplikasi\\aleta\\tmp", TEMP: "D:\\Aplikasi\\aleta\\tmp" },
      timeout: 60_000,
    });
    expect(hasil.stdout).toMatch(/Hasil: \d+ lulus, 0 gagal/);
    expect(hasil.status).toBe(0);
  });

  it("kebendaan memakai definisi bobot 2,0 milik penunjukanService, tidak diulang", () => {
    const sumber = baca("aleta_bot/services/bebanPenetapanService.js");
    expect(sumber).not.toMatch(/\b(348|364|371|365|370)\b/);
    expect(baca("aleta_bot/services/penunjukanService.js")).toContain("function adalahKebendaan(jenisPerkaraId)");
  });
});

function usulanContoh() {
  const orang = (id: number, kode: string, nama: string, o: Record<string, unknown> = {}) => ({
    id,
    kode,
    nama,
    aktif: 5,
    tahun: 40,
    hari30: 6,
    persen30: 20,
    rataRata30: 25,
    kebendaan6: 1,
    persenKebendaan6: 11.1,
    rataRataKebendaan6: 25,
    kebendaan6Total: 9,
    skor: 90,
    alasan: "bagian 30 hari 20% (rata-rata 25%), kebendaan 6 bulan 1 dari 9, 5 perkara berjalan",
    diusulkan: false,
    urutan: 1,
    ...o,
  });
  return {
    pmh: { majelisKode: "A", berbedaDariRekomendasi: true, rekomendasiBeban: { kode: "B", alasan: "x" } },
    kesesuaianSk: {
      status: "sesuai",
      untuk: "usulan",
      bunyi: "Sesuai SK 254/KPA.W19-A5/SK.HK2.6/VIII/2026 (Majelis A).",
      rinci: [] as string[],
    },
    statistik: {
      terbaca: true,
      jendela: { sekarang: "2026-10-20", dari30: "2026-09-21", dari6: "2026-04-20" },
      kebendaanPerkara: false,
      sk: {
        nomor: "254/KPA.W19-A5/SK.HK2.6/VIII/2026",
        tanggal: "2026-08-27",
        dipakai: true,
        bunyi: "SK 254/KPA.W19-A5/SK.HK2.6/VIII/2026 tanggal Kamis, 2026-08-27",
        peringatan: ["Majelis A: D4 (Munifa) - jabatannya sekarang bukan lagi panitera pengganti"],
      },
      majelis: [
        { ...orang(0, "", "", { urutan: 1, diusulkan: true }), kode: "A", anggotaKode: ["A", "C1", "C3"] },
        { ...orang(0, "", "", { urutan: 2 }), kode: "B", anggotaKode: ["B", "C2", "C3"] },
      ],
      luarSk: { perkara: 4, hari30: 1 },
      hakim: [orang(32, "A", "Fahri", { diusulkan: true })],
      panitera: [orang(1, "D", "Sri Susilowati", { diusulkan: true })],
      jurusita: [orang(3, "E2", "Mustini")],
      totalKebendaan6: { hakim: 9, panitera: 9, jurusita: 9, majelis: 9 },
      rekomendasi: {
        majelis: { kode: "B", anggotaKode: ["B", "C2", "C3"], skor: 70, alasan: "bagian 30 hari 10%" },
        hakim: null,
        panitera: { id: 1, nama: "Sri Susilowati", alasan: "bagian 30 hari 20%" },
        jurusita: { id: 3, nama: "Mustini", alasan: "bagian 30 hari 0%" },
      },
    },
  };
}

function muatModul() {
  const dom = new JSDOM("<!doctype html><body><div id='papan'></div><div id='panel'></div></body>", { runScripts: "outside-only" });
  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(baca("ekstensi-sipp/penunjukan-statistik.js"), ctx, { filename: "penunjukan-statistik.js" });
  const modul = (dom.window as unknown as { aletaPenunjukanStatistik: Modul }).aletaPenunjukanStatistik;
  return { d: dom.window.document, modul };
}

describe("blok Beban penetapan & SK", () => {
  it("papan dan panel menggambar angka dan kalimat yang sama dari objek usulan yang sama", () => {
    const { d, modul } = muatModul();
    const usulan = usulanContoh();
    modul.tempelDi(d.getElementById("papan")!, usulan, { terbuka: false });
    modul.tempelDi(d.getElementById("panel")!, usulan, { terbuka: true });
    expect(d.querySelector("#papan [data-bebanstat]")!.textContent).toBe(d.querySelector("#panel [data-bebanstat]")!.textContent);
    expect((d.querySelector("#papan [data-bebanstat]") as HTMLDetailsElement).open).toBe(false);
    expect((d.querySelector("#panel [data-bebanstat]") as HTMLDetailsElement).open).toBe(true);
  });

  it("menampilkan nomor SK, kesesuaian, rekomendasi, jumlah, bagian persen, dan kebendaan 6 bulan", () => {
    const { d, modul } = muatModul();
    modul.tempelDi(d.getElementById("papan")!, usulanContoh());
    const teks = d.getElementById("papan")!.textContent!;
    expect(teks).toContain("254/KPA.W19-A5/SK.HK2.6/VIII/2026");
    expect(teks).toContain("Sesuai SK 254");
    expect(teks).toContain("Majelis paling ringan bebannya: Majelis B");
    expect(teks).toContain("6 (20%, rata-rata 25%)");
    expect(teks).toContain("1 dari 9 (11,1%)");
    expect(teks).toContain("Majelis A");
    expect(teks).toContain("Fahri (usulan)");
    expect(teks).toContain("Smart Majelis SIPP tetap dihormati");
  });

  it("menandai pegawai SK yang perlu diperbarui dan SK yang belum diisi", () => {
    const { d, modul } = muatModul();
    modul.tempelDi(d.getElementById("papan")!, usulanContoh());
    expect(d.querySelector("[data-bebanstat-sk-perlu]")!.textContent).toContain("Munifa");
    expect(d.querySelector("[data-bebanstat-sk-perlu]")!.textContent).toContain("halaman SK Majelis");

    const kosong = usulanContoh();
    kosong.statistik.sk = {
      nomor: "",
      tanggal: "",
      dipakai: false,
      bunyi: "Belum memakai SK - isi di Pengaturan SK Majelis (susunan memakai majelis yang terpakai tahun ini)",
      peringatan: [],
    };
    kosong.kesesuaianSk = { status: "belum_ada_sk", untuk: "usulan", bunyi: "Belum memakai SK - isi di Pengaturan SK Majelis.", rinci: [] };
    modul.tempelDi(d.getElementById("panel")!, kosong);
    expect(d.getElementById("panel")!.textContent).toContain("Belum memakai SK - isi di Pengaturan SK Majelis");
    expect(d.querySelector("#panel [data-bebanstat-sk-perlu]")).toBeNull();
    expect(d.querySelector("#panel .aleta-bebanstat-sk.aleta-bebanstat-awas")).not.toBeNull();
  });

  it("tanpa statistik (server lama / gagal baca) tidak menggambar apa pun dan tidak melempar", () => {
    const { d, modul } = muatModul();
    expect(modul.tempelDi(d.getElementById("papan")!, { pmh: {}, statistik: null })).toBeNull();
    expect(d.querySelector("[data-bebanstat]")).toBeNull();
  });

  it("menggambar ulang tidak menggandakan blok", () => {
    const { d, modul } = muatModul();
    modul.tempelDi(d.getElementById("papan")!, usulanContoh());
    modul.tempelDi(d.getElementById("papan")!, usulanContoh());
    expect(d.querySelectorAll("#papan [data-bebanstat]")).toHaveLength(1);
  });
});

describe("kabel ke papan dan panel", () => {
  it("papan (konten.js) dan panel (penetapan-sipp.js) sama-sama memanggil modul yang sama", () => {
    expect(baca("ekstensi-sipp/konten.js")).toContain("aletaPenunjukanStatistik.tempelDi(isi, usulan");
    expect(baca("ekstensi-sipp/penetapan-sipp.js")).toContain("aletaPenunjukanStatistik.tempelDi(ctx.beban, ctx.data.usulan");
  });

  it("modul dimuat sebelum konten.js dan terdaftar di manifest serta penyusun ekstensi", () => {
    const manifest = baca("ekstensi-sipp/manifest.json");
    expect(manifest.indexOf("penunjukan-statistik.js")).toBeGreaterThan(-1);
    expect(manifest.indexOf("penunjukan-statistik.js")).toBeLessThan(manifest.indexOf('"konten.js"'));
    expect(baca("manajemen_surat/scripts/susun-ekstensi.mjs")).toContain('"penunjukan-statistik.js"');
  });

  it("tidak ada rumus beban di peramban: modul tidak menghitung sendiri", () => {
    const sumber = baca("ekstensi-sipp/penunjukan-statistik.js");
    expect(sumber).not.toMatch(/Math\.(round|floor|max|min)/);
    expect(sumber).not.toContain("innerHTML");
  });

  it("SK majelis tidak dibuat ulang: pengaturan SK yang ada dipakai, tanpa migrasi baru", () => {
    expect(baca("manajemen_surat/src/server/modules/aleta-ecourt/penunjukan-pengaturan.ts")).toContain("bacaSkMajelis(db)");
    expect(baca("manajemen_surat/drizzle/meta/_journal.json")).not.toContain("beban");
  });
});
