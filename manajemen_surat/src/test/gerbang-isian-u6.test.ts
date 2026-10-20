// @vitest-environment node
/**
 * ============================================================================
 * 20 OKT 2026 - GERBANG OTOMATIS BERDASAR (agen U6)
 * ============================================================================
 * Satu tempat (aleta_bot/config/gerbang-isian.json) yang menentukan "terisi sendiri" vs "saran ragu" berdasar ukuran ketepatan.
 *   A  perilaku gerbang: tanpa ukuran -> ragu; saran -> ragu; otomatis -> tetap, pasti dibatasi pangkatMaks; isian petugas dan
 *      keyakinan non-otomatis tidak disentuh; ketepatan tertulis di catatan; dua kali terapkan sama dengan sekali;
 *   B  JUJUR: berkas gerbang cocok dengan hitungan ulang dari data ukur mentah (tak ada entri yang dilonggarkan dengan tangan),
 *      tiap entri otomatis punya pembanding >= 20 dan >= 90% cocok, atau berstatus terstruktur dengan alasan;
 *   C  PENJAGA: tiap kode yang ditulis pengisi (pindai statis berkas abtIsian dan isiOtomatis, termasuk berkas BARU) dengan pasti/cukup
 *      tercatat di gerbang (terukur) atau di belumTerukur; dan tiap kode pasti/cukup yang muncul pada ukuran mentah punya entri;
 *   D  rute /abt/usulan: usulan yang dikeluarkan lewat gerbang yang sama (jalur terpasang).
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot", "package.json"));
const G = require_(path.join(AKAR, "aleta_bot", "services", "gerbangIsian.js")) as {
  terapkan: (u: any[], o?: any) => any[];
  putuskan: (u: any, g?: any) => any;
  pindaiPengisi: () => Record<string, string[]>;
  kodeTercatat: (g?: any) => Set<string>;
  muat: () => any;
};
const gerbang = JSON.parse(readFileSync(path.join(AKAR, "aleta_bot", "config", "gerbang-isian.json"), "utf8"));
const baca = (n: string) => JSON.parse(readFileSync(path.join(AKAR, "docs", "isi-sipp-abt", n), "utf8"));

const uji = {
  kode: {
    "5197": { asal: { posita: { n: 500, banding: 400, cocok: 380, persen: 95, status: "otomatis", pangkatMaks: "cukup" }, sipp: { n: 300, banding: 30, cocok: 30, persen: 100, status: "otomatis", pangkatMaks: "pasti" } } },
    "1002": { asal: { posita: { n: 500, banding: 400, cocok: 200, persen: 50, status: "saran", pangkatMaks: "ragu" } } },
    "1183": { asal: { sipp: { n: 100, banding: 0, cocok: 0, persen: null, status: "terstruktur", pangkatMaks: "cukup" } } },
  },
};
const u = (kode: string, y: string, asal = "posita", extra: any = {}) => ({ kode, nama: "x", nilai: "v", keyakinan: y, sumber: [{ saksi: 0, asal: asal === "sipp" ? "sipp" : "posita-gugatan", kalimat: "k" }], catatan: "", ...extra });

describe("A. perilaku gerbang", () => {
  it("kode+asal tanpa ukuran diturunkan menjadi ragu dan diberi alasan", () => {
    const [r] = G.terapkan([u("9999", "pasti")], { gerbang: uji });
    expect(r.keyakinan).toBe("ragu");
    expect(r.keyakinanSemula).toBe("pasti");
    expect(r.gerbang.status).toBe("tanpa-ukuran");
    expect(r.catatan).toMatch(/belum diukur/);
  });
  it("terukur 'saran' tidak pernah terisi sendiri; terukur otomatis tetap, dibatasi pangkatMaks", () => {
    const [a, b, c, d] = G.terapkan([u("1002", "cukup"), u("5197", "pasti"), u("5197", "pasti", "sipp"), u("1183", "pasti", "sipp")], { gerbang: uji });
    expect(a.keyakinan).toBe("ragu");
    expect(a.catatan).toMatch(/50%/);
    expect(b.keyakinan).toBe("cukup"); // pangkatMaks cukup: pasti dari posita turun satu tingkat
    expect(c.keyakinan).toBe("pasti");
    expect(c.gerbang.persen).toBe(100);
    expect(c.catatan).toMatch(/Terukur 100%/);
    expect(d.keyakinan).toBe("cukup"); // terstruktur
    expect(d.catatan).toMatch(/Dibaca langsung dari data SIPP/);
  });
  it("isian petugas, ragu, bentrok, tidak_ada_sumber tidak disentuh; dua kali terapkan = sekali", () => {
    const daftar = [
      u("9999", "pasti", "sipp", { sumber: [{ saksi: 0, asal: "isian-petugas", kalimat: "p" }] }),
      u("9999", "ragu"),
      u("9999", "bentrok"),
      u("9999", "tidak_ada_sumber"),
      u("5197", "cukup"),
    ];
    G.terapkan(daftar, { gerbang: uji });
    expect(daftar.map((x) => x.keyakinan)).toEqual(["pasti", "ragu", "bentrok", "tidak_ada_sumber", "cukup"]);
    const salinan = JSON.stringify(daftar);
    G.terapkan(daftar, { gerbang: uji });
    expect(JSON.stringify(daftar)).toBe(salinan);
  });
  it("saklar ALETA_GERBANG_ISIAN=mati (untuk skrip ukur) menonaktifkan penurunan", () => {
    process.env.ALETA_GERBANG_ISIAN = "mati";
    try {
      expect(G.terapkan([u("9999", "pasti")], { gerbang: uji })[0].keyakinan).toBe("pasti");
    } finally {
      delete process.env.ALETA_GERBANG_ISIAN;
    }
  });
});

describe("B. berkas gerbang jujur terhadap data ukur", () => {
  const mentah = [baca("UKURAN-GERBANG-U6-ACAK.json"), baca("UKURAN-GERBANG-U6-TERSTRUKTUR.json")];
  const gabung: Record<string, { kode: string; asal: string; n: number; banding: number; cocok: number; perYakin: Record<string, { n: number }> }> = {};
  for (const m of mentah) {
    for (const [k, a] of Object.entries<any>(m.agregat)) {
      const t = (gabung[k] = gabung[k] || { kode: a.kode, asal: a.asal, n: 0, banding: 0, cocok: 0, perYakin: {} });
      t.n += a.n;
      t.banding += a.banding;
      t.cocok += a.cocok;
      for (const [y, v] of Object.entries<any>(a.perYakin)) (t.perYakin[y] = t.perYakin[y] || { n: 0 }).n += v.n;
    }
  }
  const aturan = (a: { asal: string; n: number; banding: number; cocok: number }) => {
    const r = a.banding ? a.cocok / a.banding : null;
    if (a.banding >= 20) return r! >= 0.97 ? ["otomatis", "pasti"] : r! >= 0.9 ? ["otomatis", "cukup"] : ["saran", "ragu"];
    if (a.asal === "sipp" && a.n >= 15 && (a.banding === 0 || r! >= 0.9)) return ["terstruktur", "cukup"];
    return ["saran", "ragu"];
  };
  it("setiap entri berkas gerbang sama dengan hitungan ulang dari data mentah (tidak dilonggarkan dengan tangan)", () => {
    let dicek = 0;
    for (const a of Object.values(gabung)) {
      const e = gerbang.kode[a.kode]?.asal?.[a.asal];
      expect(e, `${a.kode}@${a.asal} hilang`).toBeTruthy();
      expect([e.status, e.pangkatMaks], `${a.kode}@${a.asal}`).toEqual(aturan(a));
      expect(e.n).toBe(a.n);
      expect(e.banding).toBe(a.banding);
      dicek++;
    }
    expect(dicek).toBeGreaterThan(100);
    expect(Object.values<any>(gerbang.kode).reduce((j, e) => j + Object.keys(e.asal).length, 0)).toBe(dicek);
  });
  it("entri otomatis wajib punya pembanding >= 20 dengan >= 90% cocok; terstruktur wajib beralasan dan tanpa selisih besar", () => {
    let otomatis = 0;
    for (const [kode, e] of Object.entries<any>(gerbang.kode)) {
      for (const [asal, v] of Object.entries<any>(e.asal)) {
        if (v.status === "otomatis") {
          otomatis++;
          expect(v.banding, `${kode}@${asal}`).toBeGreaterThanOrEqual(20);
          expect(v.cocok / v.banding, `${kode}@${asal}`).toBeGreaterThanOrEqual(0.9);
          if (v.pangkatMaks === "pasti") expect(v.cocok / v.banding).toBeGreaterThanOrEqual(0.97);
        } else if (v.status === "terstruktur") {
          expect(v.dasar).toMatch(/kolom SIPP/);
          if (v.banding) expect(v.cocok / v.banding).toBeGreaterThanOrEqual(0.9);
          expect(asal).toBe("sipp");
        } else expect(v.status).toBe("saran");
      }
    }
    expect(otomatis).toBeGreaterThan(15);
  });
  it("sampel cukup besar dan beragam jenis perkara", () => {
    expect(gerbang.sampel.perkara).toBeGreaterThanOrEqual(1000);
    expect(Object.keys(gerbang.sampel.perJenis).length).toBeGreaterThanOrEqual(5);
  });
});

describe("C. penjaga: pengisi yang menandai pasti/cukup wajib punya ukuran", () => {
  it("tiap kode yang ditulis pengisi dengan pasti/cukup (pindai statis, termasuk berkas baru) tercatat terukur atau belumTerukur", () => {
    const tercatat = G.kodeTercatat();
    const hilang = Object.entries(G.pindaiPengisi())
      .filter(([k]) => !tercatat.has(k))
      .map(([k, lokasi]) => `${k} (${lokasi[0]})`);
    expect(hilang, `Kode pengisi tanpa ukuran gerbang - jalankan scripts/isi-sipp-abt/ukur-gerbang-u6.cjs lalu --tulis: ${hilang.join(", ")}`).toEqual([]);
  });
  it("tiap (kode, asal) yang benar-benar dipancarkan pasti/cukup pada ukuran nyata punya entri gerbang", () => {
    for (const m of [baca("UKURAN-GERBANG-U6-ACAK.json"), baca("UKURAN-GERBANG-U6-TERSTRUKTUR.json")]) {
      for (const a of Object.values<any>(m.agregat)) {
        const kuat = (a.perYakin.pasti?.n || 0) + (a.perYakin.cukup?.n || 0);
        if (kuat) expect(gerbang.kode[a.kode]?.asal?.[a.asal], `${a.kode}@${a.asal}`).toBeTruthy();
      }
    }
  });
  it("kode belumTerukur tidak boleh sekaligus terukur, dan diperlakukan sebagai saran", () => {
    for (const k of Object.keys(gerbang.belumTerukur || {})) {
      expect(gerbang.kode[k]).toBeUndefined();
      expect(G.putuskan({ kode: k, keyakinan: "pasti", sumber: [{ asal: "sipp" }] }).keyakinan).toBe("ragu");
    }
  });
  it("kode di berkas gerbang bersih dari kata aplikasi", () => {
    expect(JSON.stringify(gerbang)).not.toMatch(/aleta/i);
  });
});

describe("D. jalur terpasang di rute /abt/usulan", () => {
  it("rute memanggil gerbang untuk semua sumber usulan", () => {
    const rute = readFileSync(path.join(AKAR, "aleta_bot", "routes", "internalGatewayRoutes.js"), "utf8");
    expect(rute).toMatch(/gerbangIsian/);
    expect(rute).toMatch(/jawaban\.sipp, jawaban\.saksi, jawaban\.itsbat, jawaban\.positaLain/);
  });
});
