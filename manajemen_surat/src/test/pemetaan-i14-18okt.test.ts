// @vitest-environment node
/**
 * ============================================================================
 * PEMETAAN PAKET I14 (18 Okt): abt-relaas-pencegahan-derry - relaas panggilan sidang PENCEGAHAN PERKAWINAN (jenis 342)
 * ============================================================================
 *
 * Paket (BELUM terpasang di server; keadaan di fixtures/blangko-derry-server-17okt.json dari rtf/ paket): tiga berkas baru di `98 Relaas`:
 * [JS] 11.1 (Pemohon), 11.2 (calon suami), 11.3 (calon istri). Menu 981 tidak berubah. Yang dijaga:
 *   (A) berkas ada di folder menunya, katalog BLANGKO_RELAAS = isi folder;
 *   (B) blangkoRelaas memilih 11.1 untuk Pemohon jenis 342 (sidang pertama dan lanjutan, juga e-Court), jenis lain/tanpa jenis TIDAK berubah;
 *   (C) kunci Pemetaan blangko "pencegahan-perkawinan-*" (portal dan jurusita.js sama);
 *   (D) rute cetak massal: dokumen jenis 342 -> 11.1, tidak dipecah ke blangko T;
 *   (E) rekomendasi relaas sidang ditunda.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { nilaiCetakDokumen } from "@/app/api/aleta-ecourt/relaas-massal/cetak/nilai-cetak";
import { blangkoMenurutPemetaan, pecahDokumenPerPihak, permintaanUntukDokumen } from "@/app/api/aleta-ecourt/relaas-massal/cetak/pemetaan-cetak";
import { bawaanPemetaan, kapanDipakaiRelaas, KUNCI_BAKU, pilihKunciRelaas, uraiKunciRelaas } from "@/lib/pemetaan-blangko";
import { BLANGKO_RELAAS, blangkoCalonMempelai, blangkoRelaas, blangkoRelaasPerPihak } from "@/lib/pohon-blangko";
import { rekomendasiBlangko } from "@/lib/rekomendasi-blangko";

const FIX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "blangko-derry-server-17okt.json"), "utf8")) as { berkas: string[] };
const A = "derry_briantono/98 Relaas/";
const P11 = "[JS] 11.1. Relaas Panggilan Sidang Pencegahan Perkawinan - Pemohon.rtf";
const S11 = "[JS] 11.2. Relaas Panggilan Sidang Pencegahan Perkawinan - Calon Suami.rtf";
const I11 = "[JS] 11.3. Relaas Panggilan Sidang Pencegahan Perkawinan - Calon Istri.rtf";
const P0 = "[JS] 0. Relaas Panggilan Sidang Pertama P.rtf";
const L1P = "[JS] 1. Relaas Panggilan Sidang P (Sidang Lanjutan).rtf";
const PBT_P = "[JS] 2. Relaas Pemberitahuan Putusan P.rtf";
const berkas = (x: ReturnType<typeof blangkoRelaas>) => x?.berkas ?? null;

describe("A. pohon: tiga berkas baru ada di 98 Relaas", () => {
  it("11.1/11.2/11.3 ada di fixture; tiap blangko katalog relaas ada di folder menunya", () => {
    for (const b of [P11, S11, I11]) expect(FIX.berkas, b).toContain(`${A}${b}`);
    for (const b of BLANGKO_RELAAS.filter((x) => x.folder === "derry_briantono/98 Relaas")) expect(FIX.berkas, b.berkas).toContain(`${A}${b.berkas}`);
    const baru = BLANGKO_RELAAS.filter((b) => b.keadaan === "pencegahan-perkawinan");
    expect(baru.map((b) => b.berkas)).toEqual([P11, S11, I11]);
    expect(baru.map((b) => b.pihak)).toEqual(["pertama", "calon-mempelai", "calon-mempelai"]);
    expect(baru.map((b) => b.calon)).toEqual([undefined, "suami", "istri"]);
    expect(baru.every((b) => b.menuAbt.nama === "Relaas dan PBT (Blangko Derry)")).toBe(true);
    expect(blangkoCalonMempelai("suami").berkas).toBe(S11);
    expect(blangkoCalonMempelai("istri").berkas).toBe(I11);
  });
});

describe("B. blangkoRelaas: Pemohon jenis 342 -> 11.1; yang lain tidak berubah", () => {
  it("sidang pertama dan lanjutan, pihak pertama/keduanya, juga perkara e-Court", () => {
    for (const keadaan of ["sidang-pertama", "sidang-ditunda"] as const) {
      expect(berkas(blangkoRelaas(keadaan, "pertama", { jenisPerkaraId: 342 })), keadaan).toBe(P11);
      expect(berkas(blangkoRelaas(keadaan, "pertama", { jenisPerkaraId: "342" })), keadaan).toBe(P11);
      expect(berkas(blangkoRelaas(keadaan, "keduanya", { jenisPerkaraId: 342 })), keadaan).toBe(P11);
      expect(berkas(blangkoRelaas(keadaan, "pertama", { jenisPerkaraId: 342, lewatEcourt: true })), keadaan).toBe(P11);
      expect(berkas(blangkoRelaasPerPihak(keadaan, "pertama", { jenisPerkaraId: 342 })), keadaan).toBe(P11);
    }
  });

  it("jenis lain, jenis tak terbaca, dan keadaan lain (pemberitahuan putusan, ikrar) tetap blangko lama", () => {
    for (const opsi of [{}, { jenisPerkaraId: null }, { jenisPerkaraId: 346 }, { jenisPerkaraId: 360 }, { jenisPerkaraId: 341 }]) {
      expect(berkas(blangkoRelaas("sidang-pertama", "pertama", opsi))).toBe(P0);
      expect(berkas(blangkoRelaas("sidang-ditunda", "pertama", opsi))).toBe(L1P);
    }
    expect(berkas(blangkoRelaas("pemberitahuan-putusan", "pertama", { jenisPerkaraId: 342 }))).toBe(PBT_P);
    expect(berkas(blangkoRelaas("ikrar-talak", "keduanya", { jenisPerkaraId: 342 }))).toBe("[JS] 4. Relaas Panggilan Ikrar Talak P dan T.rtf");
    // pihak kedua pada Pdt.P pencegahan (tidak ada Termohon di SIPP) tidak ditebak: blangko lama
    expect(berkas(blangkoRelaas("sidang-pertama", "kedua", { jenisPerkaraId: 342 }))).toBe("[JS] 0. Relaas Panggilan Sidang Pertama T.rtf");
    // semua pihak hadir tetap tidak dipanggil
    expect(blangkoRelaas("sidang-ditunda", "tidak-perlu", { jenisPerkaraId: 342 })).toBeNull();
  });

  it("set e-Court lama tidak berubah tanpa jenis 342", () => {
    expect(berkas(blangkoRelaas("sidang-pertama", "pertama", { lewatEcourt: true, jenisPerkaraId: 346 }))).toBe("[JS] 5.1. Relaas Panggilan Sidang P (e-Court).rtf");
  });
});

describe("C. kunci Pemetaan blangko pencegahan-perkawinan-*", () => {
  const KUNCI = ["pencegahan-perkawinan-pemohon", "pencegahan-perkawinan-calon-suami", "pencegahan-perkawinan-calon-istri"];

  it("kunci baku + bawaan menunjuk 11.1/11.2/11.3; semua kunci dikenal", () => {
    const peta = Object.fromEntries(bawaanPemetaan("relaas").map((b) => [b.kunci, b.namaBerkas]));
    expect(KUNCI_BAKU.relaas.map((k) => k.kunci)).toEqual(expect.arrayContaining(KUNCI));
    expect(KUNCI.map((k) => peta[k])).toEqual([P11, S11, I11]);
    for (const k of KUNCI) expect(uraiKunciRelaas(k), k).toMatchObject({ awalan: "pencegahan", dikenal: true });
    expect(uraiKunciRelaas(KUNCI[0]).keadaan).toBe("pemohon");
    expect(uraiKunciRelaas(KUNCI[1]).keadaan).toBe("calon-suami");
    expect(uraiKunciRelaas(KUNCI[2]).keadaan).toBe("calon-istri");
    expect(uraiKunciRelaas("pencegahan-perkawinan-kuasa").dikenal).toBe(false);
    expect(kapanDipakaiRelaas(KUNCI[1]).dipakai).toMatch(/calon suami/);
  });

  it("kunci pencegahan hanya dipilih untuk permintaan pencegahan; kunci lama tidak pernah menangkapnya", () => {
    const minta = { awalan: "pencegahan", keadaan: "pemohon", khusus: "", umum: "" } as const;
    expect(pilihKunciRelaas([...KUNCI, "relaas-panggilan-sidang-pertama-pemohon", "panggilan-pemohon"], minta)).toBe(KUNCI[0]);
    expect(pilihKunciRelaas([...KUNCI], { ...minta, keadaan: "calon-istri" })).toBe(KUNCI[2]);
    expect(pilihKunciRelaas(KUNCI, { awalan: "panggilan", keadaan: "pertama", khusus: "pemohon", umum: "penggugat" })).toBeNull();
    expect(pilihKunciRelaas(["relaas-panggilan-sidang-pertama-pemohon"], minta)).toBeNull();
  });
});

describe("D. rute cetak massal: dokumen jenis 342", () => {
  const dasar = { perkaraId: 77, golongan: "sidang-pertama", d: 1, pihakDipanggil: "pertama", alurPerkaraId: 16, jenisPerkaraId: 342 };

  it("nilaiCetakDokumen: Pemohon -> 11.1 (sidang pertama dan lanjutan); jenis lain -> blangko lama", () => {
    expect(nilaiCetakDokumen(dasar).blangko?.berkas).toBe(P11);
    expect(nilaiCetakDokumen({ ...dasar, golongan: "sidang-lanjutan" }).blangko?.berkas).toBe(P11);
    expect(nilaiCetakDokumen({ ...dasar, pihakDipanggil: "keduanya" }).blangko?.berkas).toBe(P11);
    expect(nilaiCetakDokumen({ ...dasar, jenisPerkaraId: 360 }).blangko?.berkas).toBe(P0);
    expect(nilaiCetakDokumen({ ...dasar, jenisPerkaraId: undefined }).blangko?.berkas).toBe(P0);
    expect(nilaiCetakDokumen({ ...dasar, golongan: "pemberitahuan-putusan" }).blangko?.berkas).toBe(PBT_P);
  });

  it("pemetaan admin untuk pencegahan menang atas bawaan; kunci lama tidak ikut", () => {
    expect(permintaanUntukDokumen(dasar)).toEqual({ awalan: "pencegahan", keadaan: "pemohon", khusus: "", umum: "" });
    expect(blangkoMenurutPemetaan(dasar, { "pencegahan-perkawinan-pemohon": "x.rtf", "relaas-panggilan-sidang-pertama-pemohon": "y.rtf" }, {})).toEqual({ berkas: "x.rtf", kunci: "pencegahan-perkawinan-pemohon" });
    expect(nilaiCetakDokumen(dasar, null, { relaas: { "pencegahan-perkawinan-pemohon": "x.rtf" }, pbt: {} }).blangko?.berkas).toBe("x.rtf");
    expect(permintaanUntukDokumen({ ...dasar, jenisPerkaraId: 360 })).toMatchObject({ awalan: "panggilan", keadaan: "pertama" });
  });

  it("dokumen 'keduanya' jenis 342 tidak dipecah ke blangko T", () => {
    const dok = { ...dasar, pihakDipanggil: "keduanya", kunci: "k" };
    expect(pecahDokumenPerPihak(dok, {}, {})).toEqual([dok]);
    expect(pecahDokumenPerPihak({ ...dok, jenisPerkaraId: 360 }, {}, {}).map((x) => x.pihakDipanggil)).toEqual(["pertama", "kedua"]);
  });
});

describe("E. rekomendasi relaas sidang ditunda", () => {
  it("Pencegahan Perkawinan (id atau nama jenis) -> 11.1; jenis lain tetap blangko lanjutan", () => {
    const m = { nomorPerkara: "5/Pdt.P/2026/PA.Dgl", urutanSidang: 2, ditunda: true, dihadiriOleh: 3 };
    const pc = rekomendasiBlangko({ ...m, jenisPerkara: "Pencegahan Perkawinan" }).relaas;
    expect(pc.map((r) => r.berkas)).toContain(P11);
    expect(rekomendasiBlangko({ ...m, jenisPerkara: "Lain-Lain", jenisPerkaraId: 342 }).relaas.map((r) => r.berkas)).toContain(P11);
    const lain = rekomendasiBlangko({ ...m, jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah" }).relaas.map((r) => r.berkas);
    expect(lain).not.toContain(P11);
    expect(lain).toContain(L1P);
  });
});

describe("F. jurusita.js (ekstensi) sama dengan portal", () => {
  const EKSTENSI = path.resolve(process.cwd(), "..", "ekstensi-sipp");
  const baca = (b: string) => readFileSync(path.join(EKSTENSI, b), "utf8").replace(/\r\n/g, "\n");
  const terbuka: JSDOM[] = [];
  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 40));
    while (terbuka.length) terbuka.pop()!.window.close();
  });
  function bukaJurusita() {
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "http://192.168.10.10/SIPP/x", runScripts: "outside-only" } as ConstructorParameters<typeof JSDOM>[1]);
    terbuka.push(dom);
    const w = dom.window as unknown as Record<string, any>;
    w.chrome = {
      runtime: { id: "uji", getManifest: () => ({ version: "1.0.0" }), getURL: (x: string) => x, sendMessage: () => undefined },
      storage: { local: { get: async () => ({}), set: async () => undefined, remove: async () => undefined }, session: { get: async () => ({}), set: async () => undefined }, onChanged: { addListener: () => undefined } },
    };
    w.fetch = async () => new Response("{}", { status: 404 });
    w.Response = Response;
    (w as any).eval(`${baca("panel-alat.js")}\n;\n${baca("jurusita.js")}\n;\nwindow.__j = { urai: jurusitaUraiKunci, pilih: jurusitaPilihKunci, minta: jurusitaPermintaan, sebutan: jurusitaSebutan, pilihBlangko: jurusitaPilihBlangko, ec: jurusitaEcOpsi };`);
    return w.__j as {
      urai: (k: string) => Record<string, unknown>;
      pilih: (d: string[], m: unknown) => string | null;
      minta: (g: string, sisi: number, sebutan: unknown, ec?: unknown) => Record<string, unknown> & { tertanam: string[] };
      sebutan: (nomor: string, jenis: string, alur?: unknown, jenisId?: unknown) => unknown;
      pilihBlangko: (peta: unknown, jenis: string, minta: unknown) => { berkas: string; kunci: string; sumber: string } | null;
      ec: (x: unknown) => Record<string, unknown>;
    };
  }
  const polos = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

  it("jurusitaUraiKunci = uraiKunciRelaas untuk kunci pencegahan", () => {
    const j = bukaJurusita();
    for (const k of ["pencegahan-perkawinan-pemohon", "pencegahan-perkawinan-calon-suami", "pencegahan-perkawinan-calon-istri", "pencegahan-perkawinan-kuasa", "panggilan-pemohon"]) {
      expect(polos(j.urai(k)), k).toEqual(polos(uraiKunciRelaas(k)));
    }
  });

  it("jenis 342: Pemohon (sisi 1) sidang pertama dan lanjutan -> 11.1 dari bawaan tertanam; sisi 2 dan jenis lain tidak berubah", () => {
    const j = bukaJurusita();
    expect(polos(j.ec({ jenisPerkaraId: 342 }))).toEqual({ ecourt: false, verstek: false, pencegahan: true });
    expect(polos(j.ec({ jenisPerkaraId: 346 }))).toEqual({ ecourt: false, verstek: false });
    const seb = j.sebutan("5/Pdt.P/2026/PA.Dgl", "Pencegahan Perkawinan", 16, 342);
    const ec342 = j.ec({ jenisPerkaraId: 342 });
    for (const g of ["sidang-pertama", "sidang-ditunda", "sidang-lanjutan"]) {
      expect(j.pilihBlangko({}, "relaas", j.minta(g, 1, seb, ec342))?.berkas, g).toBe(P11);
      // admin boleh menimpa lewat kunci pencegahan; kunci sidang pertama biasa tidak menangkapnya
      const peta = { relaas: { sumber: "server", peta: { "pencegahan-perkawinan-pemohon": "z.rtf", "relaas-panggilan-sidang-pertama-pemohon": "y.rtf" } } };
      expect(j.pilihBlangko(peta, "relaas", j.minta(g, 1, seb, ec342))?.berkas, g).toBe("z.rtf");
    }
    expect(j.pilihBlangko({}, "relaas", j.minta("sidang-pertama", 2, seb, ec342))?.berkas).toBe("[JS] 0. Relaas Panggilan Sidang Pertama T.rtf");
    const biasa = j.sebutan("1/Pdt.P/2026/PA.Dgl", "Pengesahan Perkawinan/Istbat Nikah", 16, 360);
    expect(j.pilihBlangko({}, "relaas", j.minta("sidang-pertama", 1, biasa, j.ec({ jenisPerkaraId: 360 })))?.berkas).toBe(P0);
    expect(j.pilihBlangko({}, "relaas", j.minta("sidang-pertama", 1, biasa))?.berkas).toBe(P0);
  });

  it("nama tertanam 11.x di jurusita.js sama dengan BLANGKO_RELAAS", () => {
    const sumber = baca("jurusita.js");
    for (const b of [P11, S11, I11]) expect(sumber).toContain(b);
  });
});
