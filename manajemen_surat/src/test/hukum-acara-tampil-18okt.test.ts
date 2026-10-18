// @vitest-environment node
/**
 * Hukum acara satker pada rujukan yang ditampilkan (18 Okt 2026, aturan rumah): PA di luar Jawa-Madura memakai RBg; "HIR" tidak boleh tampil, "HIR/RBg" tidak pernah ditulis.
 * Data katalog tidak diubah (pasangan HIR / RBg tetap tersimpan); yang disaring hanya tampilan: saksi-katalog.js rujukanTampil, dipakai borang Susun saksi (saksi-susun.js)
 * dan panduan pertanyaan saksi portal (server/shared/pandu-saksi.ts).
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const dunia: Record<string, unknown> = {};
for (const n of ["saksi-katalog.js", "saksi-katalog-data.js"]) {
  const modul = { exports: {} };
  new Function("module", "globalThis", "self", readFileSync(path.join(AKAR, n), "utf8"))(modul, dunia, dunia);
}
type Mesin = { HUKUM_ACARA_SATKER: string; rujukanTampil(teks: string, hukumAcara?: string): string };
const mesin = dunia.AletaSaksiKatalog as Mesin;
const katalog = dunia.ALETA_SAKSI_KATALOG_DATA as Array<{ kunci: string; dasarHukum?: Array<{ rujukan: string; uraian: string; status: string }> }>;

describe("rujukanTampil: satker RBg", () => {
  it("satu pengaturan hukum acara satker, bawaan RBg", () => {
    expect(mesin.HUKUM_ACARA_SATKER).toBe("RBg");
  });

  it("segmen HIR dibuang; RBg dan KUHPerdata tetap", () => {
    expect(mesin.rujukanTampil("Pasal 171 ayat (1) dan (2) HIR / Pasal 308 ayat (1) dan (2) RBg")).toBe("Pasal 308 ayat (1) dan (2) RBg");
    expect(mesin.rujukanTampil("Pasal 169 HIR / Pasal 306 RBg / Pasal 1905 KUHPerdata")).toBe("Pasal 306 RBg / Pasal 1905 KUHPerdata");
    expect(mesin.rujukanTampil("Pasal 125 ayat (1) HIR / Pasal 149 ayat (1) RBg")).toBe("Pasal 149 ayat (1) RBg");
  });

  it("tanpa HIR: teks tidak berubah; HIR/RBg dalam satu segmen disusutkan; HIR tanpa padanan RBg tidak dikarang", () => {
    expect(mesin.rujukanTampil("Pasal 308 RBg / Pasal 1905 KUHPerdata")).toBe("Pasal 308 RBg / Pasal 1905 KUHPerdata");
    expect(mesin.rujukanTampil("Pasal 22 PP 9/1975")).toBe("Pasal 22 PP 9/1975");
    expect(mesin.rujukanTampil("tunduk pada HIR/RBg")).toBe("tunduk pada RBg");
    expect(mesin.rujukanTampil("Pasal 125 HIR")).toBe("Pasal 125 HIR");
    expect(mesin.rujukanTampil(undefined as unknown as string)).toBe("");
  });

  it("satker HIR (rencana per wilayah): sebaliknya, segmen RBg dibuang", () => {
    expect(mesin.rujukanTampil("Pasal 169 HIR / Pasal 306 RBg / Pasal 1905 KUHPerdata", "HIR")).toBe("Pasal 169 HIR / Pasal 1905 KUHPerdata");
    expect(mesin.rujukanTampil("Pasal 171 ayat (1) dan (2) HIR / Pasal 308 ayat (1) dan (2) RBg", "HIR")).toBe("Pasal 171 ayat (1) dan (2) HIR");
    expect(mesin.rujukanTampil("Pasal 308 RBg", "salah")).toBe("Pasal 308 RBg"); // nilai tak dikenal = bawaan satker
  });

  it("katalog di disk TIDAK diubah (pasangan HIR / RBg masih tersimpan), tetapi tampilannya bersih dari HIR di setiap dasar hukum", () => {
    let adaPasangan = 0;
    for (const k of katalog) {
      for (const d of k.dasarHukum ?? []) {
        if (/\bHIR\b/.test(d.rujukan)) adaPasangan++;
        const tampil = `${mesin.rujukanTampil(d.rujukan)} ${mesin.rujukanTampil(d.uraian)}`;
        expect(tampil, `${k.kunci}: ${d.rujukan}`).not.toMatch(/\bHIR\b/);
      }
    }
    expect(adaPasangan).toBeGreaterThan(5);
  });

  it("borang Susun saksi memakai rujukanTampil untuk dasar hukum yang ditampilkan", () => {
    const sumber = readFileSync(path.join(AKAR, "saksi-susun.js"), "utf8");
    expect(sumber).toContain("Mesin().rujukanTampil");
  });
});

describe("panduan saksi di portal: tidak ada HIR di teks tampil (satker RBg)", () => {
  // Memakai versi TERTANAM seperti rute panduan sungguhan. Sebelum rilis-ekstensi menanam saksi-katalog.js terbaru, mesin tertanam belum punya rujukanTampil dan
  // panduan menampilkan rujukan apa adanya: uji ini baru lolos sesudah penanaman (merah sampai ditanam).
  it("setiap dasar hukum di setiap panduan yang tersedia bebas dari HIR", async () => {
    const { susunPanduan } = await import("@/server/shared/pandu-saksi");
    const berkas = readdirSync(path.join(AKAR, "saksi-katalog")).filter((n) => n.endsWith(".json"));
    let diperiksa = 0;
    for (const n of berkas) {
      const k = JSON.parse(readFileSync(path.join(AKAR, "saksi-katalog", n), "utf8")) as { contoh?: boolean; kunci: string; tambahanUntuk?: unknown; jenisKatalog?: unknown; syarat: { jenisPerkaraId: string[]; alurPerkaraId?: string[] } };
      if (k.contoh || k.tambahanUntuk || k.jenisKatalog) continue;
      const nama = k.kunci === "pengangkatan-anak" ? "Pengangkatan Anak" : k.kunci === "hak-asuh" ? "Hak Asuh Anak" : k.kunci === "permohonan-umum" ? "Lain-lain" : k.kunci === "mafqud" ? "Lain-Lain mafqud" : "";
      const p = susunPanduan({ jenisPerkaraId: Number(k.syarat.jenisPerkaraId[0]), alurPerkaraId: k.syarat.alurPerkaraId ? Number(k.syarat.alurPerkaraId[0]) : 15, jenisPerkara: nama });
      if (!p.tersedia) continue;
      const teks: string[] = [];
      for (const pihak of ["P", "T"] as const) for (const pokok of p.saksi[pihak].pokok) for (const d of pokok.dasarHukum) teks.push(d.rujukan, d.uraian);
      for (const x of teks) expect(x, `${k.kunci}`).not.toMatch(/\bHIR\b/);
      diperiksa++;
    }
    expect(diperiksa).toBeGreaterThan(10);
  });
});
