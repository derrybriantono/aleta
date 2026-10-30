import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { bersihkanCetak, namaKelompok, susunStatistik, type CetakTercatat, type KatalogBlangko } from "@/lib/statistik-blangko";

/**
 * G6 6.4 (30 Okt 2026) - Statistik pemakaian blangko. Diuji PERILAKUNYA:
 *   - aturan murni susunStatistik/bersihkanCetak atas cetakan tiruan;
 *   - katalog bot SUNGGUHAN (katalogBlangkoDerry) atas folder RTF sementara: arsip dilewati,
 *     pasangan mirip satu folder terdeteksi, beda folder tidak dipasangkan;
 *   - ekstensi statistik-cetak.js mengirim laporan tanpa isi naskah dan tidak pernah melempar;
 *   - panel Blangko Derry memanggilnya saat cetak (jalur laporCetakWajib) tanpa klik tambahan.
 */

const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const K: any = muat(path.join(AKAR, "aleta_bot/services/katalogBlangkoDerry.js"));

const c = (kelompok: string, berkas: string, pada: string, jenisPerkara = "Cerai Gugat", sumber: CetakTercatat["sumber"] = "cetak"): CetakTercatat => ({
  kelompok,
  berkas,
  pada,
  jenisPerkara,
  perkaraId: "1",
  sumber,
});

describe("aturan murni statistik", () => {
  const katalog: KatalogBlangko = {
    berkas: [
      { rel: "1 Perceraian CG/[01] Kabul Verstek.rtf", folder: "1 Perceraian CG", nama: "[01] Kabul Verstek" },
      { rel: "1 Perceraian CG/[02] Kabul Kontradiktoir.rtf", folder: "1 Perceraian CG", nama: "[02] Kabul Kontradiktoir" },
      { rel: "1 Perceraian CG/[03] Tolak.rtf", folder: "1 Perceraian CG", nama: "[03] Tolak" },
      { rel: "1a Perceraian CT/[01] Kabul Verstek.rtf", folder: "1a Perceraian CT", nama: "[01] Kabul Verstek" },
      { rel: "2 Itsbat Nikah/[01] Kabul.rtf", folder: "2 Itsbat Nikah", nama: "[01] Kabul" },
    ],
    ganda: [{ folder: "1 Perceraian CG", a: "1 Perceraian CG/[01] Kabul Verstek.rtf", b: "1 Perceraian CG/[02] Kabul Kontradiktoir.rtf", mirip: 0.93 }],
  };

  it("paling sering, tidak pernah, per jenis perkara, dan jumlah cetak pada pasangan mirip", () => {
    const s = susunStatistik(
      [
        c("1 Perceraian CG", "[01] Kabul Verstek", "2026-10-01T01:00:00Z"),
        c("derry_briantono/1 Perceraian CG", "[01] Kabul Verstek.rtf", "2026-10-02T01:00:00Z"),
        c("1 Perceraian CG", "[02] Kabul Kontradiktoir", "2026-10-03T01:00:00Z"),
        c("1a Perceraian CT", "[01] Kabul Verstek", "2026-10-04T01:00:00Z", "Cerai Talak"),
      ],
      katalog
    );
    expect(s.jumlahCetak).toBe(4);
    expect(s.sejak).toBe("2026-10-01T01:00:00Z");
    const cg = s.perKelompok.find((k) => k.kelompok === "1 Perceraian CG")!;
    expect(cg.terbanyak[0]).toEqual({ berkas: "[01] Kabul Verstek", jumlah: 2, terakhir: "2026-10-02T01:00:00Z" });
    expect(cg.tidakPernah).toEqual(["[03] Tolak"]);
    expect(cg.dipakai).toBe(2);
    expect(cg.jumlahBlangko).toBe(3);
    // nama sama di folder lain dihitung TERPISAH (bukan digabung)
    expect(s.perKelompok.find((k) => k.kelompok === "1a Perceraian CT")!.jumlahCetak).toBe(1);
    expect(s.perKelompok.find((k) => k.kelompok === "2 Itsbat Nikah")!.tidakPernah).toEqual(["[01] Kabul"]);
    expect(s.perJenis.map((j) => [j.jenisPerkara, j.jumlahCetak])).toEqual([
      ["Cerai Gugat", 3],
      ["Cerai Talak", 1],
    ]);
    expect(s.ganda[0]).toMatchObject({ cetakA: 2, cetakB: 1, mirip: 0.93 });
  });

  it("cetakan lama tanpa folder ditempatkan hanya bila namanya unik di katalog; selain itu tidak ditebak", () => {
    const s = susunStatistik(
      [c("", "[03] Tolak", "2026-09-01T00:00:00Z", "Cerai Gugat", "lapor"), c("", "[01] Kabul Verstek", "2026-09-02T00:00:00Z", "Cerai Gugat", "lapor")],
      katalog
    );
    expect(s.perKelompok.find((k) => k.kelompok === "1 Perceraian CG")!.tidakPernah).not.toContain("[03] Tolak");
    expect(s.tanpaFolder).toBe(1); // "[01] Kabul Verstek" ada di CG dan CT
    expect(s.perKelompok.find((k) => k.kelompok === "")!.jumlahCetak).toBe(1);
  });

  it("tanpa katalog: tetap menghitung cetakan, tidak ada daftar tidak pernah/mirip", () => {
    const s = susunStatistik([c("1 Perceraian CG", "[01] Kabul Verstek", "2026-10-01T00:00:00Z")], null);
    expect(s.katalogTersedia).toBe(false);
    expect(s.perKelompok).toHaveLength(1);
    expect(s.perKelompok[0].tidakPernah).toEqual([]);
    expect(s.ganda).toEqual([]);
  });

  it("bersihkanCetak: wajib perkara + berkas; folder tanpa awalan derry_briantono; nama tanpa .rtf", () => {
    expect(bersihkanCetak({ berkas: "x.rtf" })).toBeNull();
    expect(bersihkanCetak(null)).toBeNull();
    expect(bersihkanCetak({ perkaraId: 9, berkas: "a/b/[01] X.rtf", kelompok: "derry_briantono/1 Perceraian CG", jenis: "put" })).toEqual({
      perkaraId: "9",
      nomorPerkara: "",
      kelompok: "1 Perceraian CG",
      berkas: "[01] X",
      jenisBlangko: "put",
      jenisPerkara: "",
    });
    expect(namaKelompok("derry_briantono")).toBe("");
  });
});

describe("katalog bot atas folder RTF sungguhan", () => {
  let akar = "";
  afterEach(() => {
    if (akar) rmSync(akar, { recursive: true, force: true });
    akar = "";
  });
  const rtf = (isi: string) => `{\\rtf1\\ansi{\\fonttbl{\\f0 Times;}}{\\*\\isianasal #1234#}\\f0 ${isi}\\par }`;
  const kalimat = Array.from({ length: 60 }, (_, i) => `kata${i}`).join(" ");

  it("melewati arsip, memasangkan yang hampir sama satu folder, tidak memasangkan beda folder", async () => {
    akar = mkdtempSync(path.join(process.env.TMP || os.tmpdir(), "katalog-"));
    const d = path.join(akar, "derry_briantono");
    for (const f of ["1 Perceraian CG", "1a Perceraian CT", "terhapus/1 Perceraian CG", "ALUR 01 lama"]) mkdirSync(path.join(d, f), { recursive: true });
    writeFileSync(path.join(d, "1 Perceraian CG/[01] A.rtf"), rtf(`${kalimat} amar pertama`), "latin1");
    writeFileSync(path.join(d, "1 Perceraian CG/[01b] A varian.rtf"), rtf(`${kalimat} amar kedua`), "latin1");
    writeFileSync(path.join(d, "1 Perceraian CG/[02] Lain.rtf"), rtf("isi yang sama sekali berbeda dengan blangko lain di folder ini"), "latin1");
    writeFileSync(path.join(d, "1a Perceraian CT/[01] A.rtf"), rtf(`${kalimat} amar pertama`), "latin1");
    writeFileSync(path.join(d, "terhapus/1 Perceraian CG/[01] A.rtf"), rtf(`${kalimat} amar pertama`), "latin1");
    writeFileSync(path.join(d, "ALUR 01 lama/[9] B.rtf"), rtf("arsip"), "latin1");
    const h = await K.buatKatalog({ akarBlangko: akar }).katalog();
    expect(h.berkas.map((b: { rel: string }) => b.rel)).toEqual(["1 Perceraian CG/[01] A.rtf", "1 Perceraian CG/[01b] A varian.rtf", "1 Perceraian CG/[02] Lain.rtf", "1a Perceraian CT/[01] A.rtf"]);
    expect(h.ganda).toHaveLength(1);
    expect(h.ganda[0]).toMatchObject({ folder: "1 Perceraian CG", a: "1 Perceraian CG/[01] A.rtf", b: "1 Perceraian CG/[01b] A varian.rtf" });
    expect(h.ganda[0].mirip).toBeGreaterThanOrEqual(0.9);
    // isi grup tersembunyi {\*...} dan tabel huruf tidak ikut dibandingkan
    expect(K.kataRtf(rtf("halo dunia"))).toEqual(["halo", "dunia"]);
  });
});

describe("ekstensi statistik-cetak.js", () => {
  afterEach(() => vi.unstubAllGlobals());
  const api = () => {
    const kode = readFileSync(path.join(AKAR, "ekstensi-sipp/statistik-cetak.js"), "utf8");
    const m = { exports: {} as Record<string, unknown> };
    new Function("module", "globalThis", kode)(m, {});
    return m.exports as { laporCetak: (d: unknown) => Promise<unknown> };
  };

  it("mengirim folder, berkas, jenis - tanpa isi naskah; gagal jaringan tidak melempar", async () => {
    const kirim = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal("fetch", kirim);
    const { laporCetak } = api();
    expect(await laporCetak({ perkaraId: "10179", nomorPerkara: "622/Pdt.G/2026/PA.Dgl", kelompok: "1 Perceraian CG", berkas: "[01] X", jenisBlangko: "put", jenisPerkara: "Cerai Gugat", isi: "RAHASIA" })).toBe(true);
    const [url, opsi] = kirim.mock.calls[0] as unknown as [string, { body: string }];
    expect(url).toBe("/aleta/api/aleta-ecourt/statistik-blangko");
    const badan = JSON.parse(opsi.body);
    expect(badan).toEqual({ aksi: "cetak", perkaraId: "10179", nomorPerkara: "622/Pdt.G/2026/PA.Dgl", kelompok: "1 Perceraian CG", berkas: "[01] X", jenisBlangko: "put", jenisPerkara: "Cerai Gugat" });
    expect(opsi.body).not.toContain("RAHASIA");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("putus"))));
    expect(await api().laporCetak({ perkaraId: "1", berkas: "x" })).toBeNull();
    expect(await api().laporCetak({ berkas: "x" })).toBeNull();
  });

  it("terdaftar di manifest (halaman ABT, bersama panel Blangko Derry) dan dipanggil di jalur cetak", () => {
    const m = JSON.parse(readFileSync(path.join(AKAR, "ekstensi-sipp/manifest.json"), "utf8")) as { content_scripts: Array<{ js?: string[] }> };
    const grup = m.content_scripts.find((g) => (g.js ?? []).includes("blangko-derry-isian.js"))!;
    expect(grup.js!.indexOf("statistik-cetak.js")).toBeGreaterThanOrEqual(0);
    expect(grup.js!.indexOf("statistik-cetak.js")).toBeLessThan(grup.js!.indexOf("blangko-derry-isian.js"));
    const susun = readFileSync(path.join(AKAR, "manajemen_surat/scripts/susun-ekstensi.mjs"), "utf8");
    expect(susun).toContain('"statistik-cetak.js"');
  });
});
