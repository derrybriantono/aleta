// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { nilaiCetakDokumen } from "@/app/api/aleta-ecourt/relaas-massal/cetak/nilai-cetak";
import { blangkoMenurutPemetaan, pecahDokumenPerPihak, permintaanUntukDokumen } from "@/app/api/aleta-ecourt/relaas-massal/cetak/pemetaan-cetak";
import {
  bawaanPemetaan,
  KUNCI_BAKU,
  nilaiKunciRelaas,
  pilihKunciRelaas,
  uraiKunciRelaas,
  type PermintaanRelaas,
} from "@/lib/pemetaan-blangko";
import { BLANGKO_RELAAS, blangkoAmplopPendamping, blangkoRelaas, blangkoRelaasPerPihak } from "@/lib/pohon-blangko";

/**
 * ============================================================================
 * RELAAS e-COURT MENURUT "LEWAT e-COURT" (Q3, 16 Okt 2026; peta perkara L3 15 Okt, kesenjangan bagian 4)
 * ============================================================================
 *
 * Folder derry_briantono/Relaas di server memuat 22 berkas; pohon-blangko.ts dulu hanya mengenal 12 (10 berkas e-Court dan amplop tak terpetakan:
 * [JS] 5.1, 5.2, 6.2, 7, 8.1.1-8.3.2 - dibutuhkan 2.196 perkara e-Court). Yang dijaga di sini:
 *   1. daftar BLANGKO_RELAAS = isi folder server (22 nama persis);
 *   2. tanpa penanda e-Court perilaku LAMA tidak berubah sedikit pun;
 *   3. blangkoRelaas memilih 5.1/5.2 (sidang pertama dan lanjutan), 6.2 (pemberitahuan putusan VERSTEK untuk T), 7 (ikrar) bila lewatEcourt;
 *   4. amplop pendamping menurut keadaan dan e-Court;
 *   5. kunci pemetaan admin: kata "ecourt"/"verstek" (portal dan jurusita.js sama persis), bawaan e-Court menang atas kunci admin biasa,
 *      kunci e-Court admin menang atas bawaan;
 *   6. nilaiCetakDokumen (rute cetak) memakainya, termasuk rentang proses menu untuk ikrar e-Court.
 */

const FOLDER_SERVER = [
  "[JS] --AMPLOP PANGGILAN SURAT TERCATAT--.rtf",
  "[JS] 0. Relaas Panggilan Sidang Pertama P.rtf",
  "[JS] 0. Relaas Panggilan Sidang Pertama T.rtf",
  "[JS] 1. Relaas Panggilan Sidang P (Sidang Lanjutan).rtf",
  "[JS] 1. Relaas Panggilan Sidang T (Sidang Lanjutan).rtf",
  "[JS] 2. Relaas Pemberitahuan Putusan P.rtf",
  "[JS] 2. Relaas Pemberitahuan Putusan T.rtf",
  "[JS] 3.a. Permohonan Bantuan Panggilan Delegasi.rtf",
  "[JS] 3.b. Relaas Panggilan Sidang P dan T.rtf",
  "[JS] 4. Relaas Panggilan Ikrar Talak P dan T.rtf",
  "[JS] 5.1. Relaas Panggilan Sidang P (e-Court).rtf",
  "[JS] 5.2. Relaas Panggilan Sidang T (e-Court).rtf",
  "[JS] 6.2. Relaas Pemberitahuan Putusan Verstek T (e-Court).rtf",
  "[JS] 7. Relaas Panggilan Ikrar Talak (e-Court).rtf",
  "[JS] 8.1.1. Amplop Relaas Panggilan Sidang P.rtf",
  "[JS] 8.1.2. Amplop Relaas Panggilan Sidang T.rtf",
  "[JS] 8.2.1. Amplop Relaas Pemberitahuan Putusan P.rtf",
  "[JS] 8.2.2. Amplop Relaas Pemberitahuan Putusan T.rtf",
  "[JS] 8.3.1. Amplop Relaas Panggilan Ikrar Talak P.rtf",
  "[JS] 8.3.2. Amplop Relaas Panggilan Ikrar Talak T.rtf",
  "[JS] 9.1. Pengumuman Permohonan Itsbat Nikah (2 Pemohon).rtf",
  "[JS] 9.2. Pengumuman Permohonan Itsbat Nikah (1 Pemohon).rtf",
  // I2 16 Okt: paket abt-mediasi-derry (terpasang; diperiksa di server 16 Okt) - panggilan pertemuan mediasi per pihak.
  "[JS] 10.1. Relaas Panggilan Mediasi P.rtf",
  "[JS] 10.2. Relaas Panggilan Mediasi T.rtf",
  // I14 18 Okt: paket abt-relaas-pencegahan-derry (BELUM terpasang) - panggilan sidang pencegahan perkawinan (jenis 342).
  "[JS] 11.1. Relaas Panggilan Sidang Pencegahan Perkawinan - Pemohon.rtf",
  "[JS] 11.2. Relaas Panggilan Sidang Pencegahan Perkawinan - Calon Suami.rtf",
  "[JS] 11.3. Relaas Panggilan Sidang Pencegahan Perkawinan - Calon Istri.rtf",
];

const EC = { lewatEcourt: true };
const ECV = { lewatEcourt: true, verstek: true };
const berkas = (x: ReturnType<typeof blangkoRelaas>) => x?.berkas ?? null;

describe("daftar blangko relaas = isi folder server", () => {
  it("27 nama persis (22 + mediasi I2 + 3 pencegahan perkawinan I14); 10 yang baru berturut-turut di belakang, 5.1/5.2/6.2/7 bertanda ecourt", () => {
    expect(BLANGKO_RELAAS.map((b) => b.berkas).sort()).toEqual([...FOLDER_SERVER].sort());
    expect(BLANGKO_RELAAS).toHaveLength(27);
    expect(BLANGKO_RELAAS.filter((b) => b.ecourt).map((b) => b.berkas)).toEqual([
      "[JS] 5.1. Relaas Panggilan Sidang P (e-Court).rtf",
      "[JS] 5.2. Relaas Panggilan Sidang T (e-Court).rtf",
      "[JS] 6.2. Relaas Pemberitahuan Putusan Verstek T (e-Court).rtf",
      "[JS] 7. Relaas Panggilan Ikrar Talak (e-Court).rtf",
    ]);
    expect(BLANGKO_RELAAS.filter((b) => b.verstek).map((b) => b.berkas)).toEqual(["[JS] 6.2. Relaas Pemberitahuan Putusan Verstek T (e-Court).rtf"]);
  });
});

describe("blangkoRelaas: tanpa penanda e-Court perilaku lama", () => {
  it("jawaban sama dengan sebelum set e-Court ada", () => {
    expect(berkas(blangkoRelaas("sidang-pertama", "pertama"))).toBe("[JS] 0. Relaas Panggilan Sidang Pertama P.rtf");
    expect(berkas(blangkoRelaas("sidang-pertama", "kedua"))).toBe("[JS] 0. Relaas Panggilan Sidang Pertama T.rtf");
    expect(berkas(blangkoRelaas("sidang-pertama", "keduanya"))).toBe("[JS] 3.b. Relaas Panggilan Sidang P dan T.rtf");
    expect(berkas(blangkoRelaas("sidang-ditunda", "kedua"))).toBe("[JS] 1. Relaas Panggilan Sidang T (Sidang Lanjutan).rtf");
    expect(berkas(blangkoRelaas("pemberitahuan-putusan", "kedua"))).toBe("[JS] 2. Relaas Pemberitahuan Putusan T.rtf");
    expect(berkas(blangkoRelaas("ikrar-talak", "keduanya"))).toBe("[JS] 4. Relaas Panggilan Ikrar Talak P dan T.rtf");
    expect(berkas(blangkoRelaas("amplop"))).toBe("[JS] --AMPLOP PANGGILAN SURAT TERCATAT--.rtf");
    // penanda salah/ tidak diketahui: tetap lama
    for (const opsi of [{ lewatEcourt: false, verstek: true }, { lewatEcourt: null, verstek: true }, {}]) {
      expect(berkas(blangkoRelaas("pemberitahuan-putusan", "kedua", opsi))).toBe("[JS] 2. Relaas Pemberitahuan Putusan T.rtf");
      expect(berkas(blangkoRelaas("sidang-pertama", "kedua", opsi))).toBe("[JS] 0. Relaas Panggilan Sidang Pertama T.rtf");
    }
    expect(berkas(blangkoRelaasPerPihak("sidang-pertama", "pertama"))).toBe("[JS] 0. Relaas Panggilan Sidang Pertama P.rtf");
  });
});

describe("blangkoRelaas: perkara e-Court", () => {
  it("sidang pertama dan lanjutan: 5.1 untuk P, 5.2 untuk T; dua pihak sekaligus tetap gabungan (rute memecahnya per pihak)", () => {
    for (const keadaan of ["sidang-pertama", "sidang-ditunda"] as const) {
      expect(berkas(blangkoRelaas(keadaan, "pertama", EC))).toBe("[JS] 5.1. Relaas Panggilan Sidang P (e-Court).rtf");
      expect(berkas(blangkoRelaas(keadaan, "kedua", EC))).toBe("[JS] 5.2. Relaas Panggilan Sidang T (e-Court).rtf");
      expect(berkas(blangkoRelaas(keadaan, "keduanya", EC))).toBe("[JS] 3.b. Relaas Panggilan Sidang P dan T.rtf");
    }
    expect(berkas(blangkoRelaasPerPihak("sidang-pertama", "pertama", EC))).toBe("[JS] 5.1. Relaas Panggilan Sidang P (e-Court).rtf");
    expect(berkas(blangkoRelaasPerPihak("sidang-ditunda", "kedua", EC))).toBe("[JS] 5.2. Relaas Panggilan Sidang T (e-Court).rtf");
  });

  it("pemberitahuan putusan: 6.2 hanya untuk T bila VERSTEK; selainnya [JS] 2", () => {
    expect(berkas(blangkoRelaas("pemberitahuan-putusan", "kedua", ECV))).toBe("[JS] 6.2. Relaas Pemberitahuan Putusan Verstek T (e-Court).rtf");
    expect(berkas(blangkoRelaas("pemberitahuan-putusan", "kedua", EC))).toBe("[JS] 2. Relaas Pemberitahuan Putusan T.rtf");
    expect(berkas(blangkoRelaas("pemberitahuan-putusan", "pertama", ECV))).toBe("[JS] 2. Relaas Pemberitahuan Putusan P.rtf");
    // semua pihak hadir: tidak ada blangko (aturan lama tidak berubah)
    expect(blangkoRelaas("pemberitahuan-putusan", "tidak-perlu", ECV)).toBeNull();
  });

  it("ikrar talak: [JS] 7 untuk Termohon (kedua atau keduanya); Pemohon e-Court belum punya blangko -> biasa", () => {
    expect(berkas(blangkoRelaas("ikrar-talak", "kedua", EC))).toBe("[JS] 7. Relaas Panggilan Ikrar Talak (e-Court).rtf");
    expect(berkas(blangkoRelaas("ikrar-talak", "keduanya", EC))).toBe("[JS] 7. Relaas Panggilan Ikrar Talak (e-Court).rtf");
    expect(berkas(blangkoRelaas("ikrar-talak", "pertama", EC))).toBe("[JS] 4. Relaas Panggilan Ikrar Talak P dan T.rtf");
  });

  it("keadaan lain (delegasi, pengumuman itsbat) tidak terpengaruh e-Court", () => {
    expect(berkas(blangkoRelaas("delegasi", "tidak-diketahui", ECV))).toBe("[JS] 3.a. Permohonan Bantuan Panggilan Delegasi.rtf");
    expect(berkas(blangkoRelaas("pengumuman-itsbat", "pertama", EC))).toBe("[JS] 9.2. Pengumuman Permohonan Itsbat Nikah (1 Pemohon).rtf");
  });
});

describe("amplop pendamping", () => {
  it("non e-Court: amplop 8.1.x panggilan sidang; e-Court: hanya T (surat tercatat), P elektronik tanpa amplop", () => {
    expect(berkas(blangkoAmplopPendamping("sidang-pertama", "pertama"))).toBe("[JS] 8.1.1. Amplop Relaas Panggilan Sidang P.rtf");
    expect(berkas(blangkoAmplopPendamping("sidang-ditunda", "kedua"))).toBe("[JS] 8.1.2. Amplop Relaas Panggilan Sidang T.rtf");
    expect(berkas(blangkoAmplopPendamping("sidang-pertama", "kedua", EC))).toBe("[JS] --AMPLOP PANGGILAN SURAT TERCATAT--.rtf");
    expect(blangkoAmplopPendamping("sidang-pertama", "pertama", EC)).toBeNull();
  });
  it("pemberitahuan putusan 8.2.x dan ikrar talak 8.3.x per pihak; keadaan lain tanpa amplop", () => {
    expect(berkas(blangkoAmplopPendamping("pemberitahuan-putusan", "pertama"))).toBe("[JS] 8.2.1. Amplop Relaas Pemberitahuan Putusan P.rtf");
    expect(berkas(blangkoAmplopPendamping("pemberitahuan-putusan", "kedua", ECV))).toBe("[JS] 8.2.2. Amplop Relaas Pemberitahuan Putusan T.rtf");
    expect(berkas(blangkoAmplopPendamping("ikrar-talak", "pertama"))).toBe("[JS] 8.3.1. Amplop Relaas Panggilan Ikrar Talak P.rtf");
    expect(berkas(blangkoAmplopPendamping("ikrar-talak", "kedua", EC))).toBe("[JS] 8.3.2. Amplop Relaas Panggilan Ikrar Talak T.rtf");
    expect(blangkoAmplopPendamping("delegasi", "kedua")).toBeNull();
  });
});

describe("kunci pemetaan admin: kata ecourt dan verstek", () => {
  const minta = (m: Partial<PermintaanRelaas>): PermintaanRelaas => ({ awalan: "panggilan", keadaan: "pertama", khusus: "tergugat", umum: "tergugat", ...m });

  it("diurai: ecourt / e-court / verstek dikenali dan tidak dianggap kata asing", () => {
    expect(uraiKunciRelaas("relaas-panggilan-sidang-pertama-ecourt-tergugat")).toMatchObject({ ecourt: true, verstek: false, dikenal: true, keadaan: "pertama", pihak: "tergugat" });
    expect(uraiKunciRelaas("Relaas panggilan sidang pertama e-Court tergugat")).toMatchObject({ ecourt: true, dikenal: true, asing: [] });
    expect(uraiKunciRelaas("pbt-ecourt-verstek-tergugat")).toMatchObject({ awalan: "pbt", ecourt: true, verstek: true, dikenal: true });
    expect(uraiKunciRelaas("panggilan-tergugat")).toMatchObject({ ecourt: false, verstek: false });
    // "e" atau "court" tanpa pasangannya tetap asing
    expect(uraiKunciRelaas("panggilan-court-tergugat").dikenal).toBe(false);
  });

  it("kunci e-Court hanya untuk dokumen e-Court dan menang atas kunci biasa", () => {
    const daftar = ["relaas-panggilan-sidang-pertama-tergugat", "relaas-panggilan-sidang-pertama-ecourt-tergugat"];
    expect(pilihKunciRelaas(daftar, minta({}))).toBe("relaas-panggilan-sidang-pertama-tergugat");
    expect(pilihKunciRelaas(daftar, minta({ ecourt: true }))).toBe("relaas-panggilan-sidang-pertama-ecourt-tergugat");
    expect(nilaiKunciRelaas("relaas-panggilan-sidang-pertama-ecourt-tergugat", minta({}))).toBe(-1);
    expect(nilaiKunciRelaas("pbt-ecourt-verstek-tergugat", minta({ awalan: "pbt", keadaan: "", ecourt: true }))).toBe(-1); // bukan verstek
    expect(nilaiKunciRelaas("pbt-ecourt-verstek-tergugat", minta({ awalan: "pbt", keadaan: "", ecourt: true, verstek: true }))).toBeGreaterThan(0);
  });

  it("bawaan server memuat kunci e-Court dan amplop, tiap berkas ada di folder server", () => {
    const relaas = Object.fromEntries(bawaanPemetaan("relaas").map((b) => [b.kunci, b.namaBerkas]));
    const pbt = Object.fromEntries(bawaanPemetaan("pbt").map((b) => [b.kunci, b.namaBerkas]));
    expect(relaas["relaas-panggilan-sidang-pertama-ecourt-penggugat"]).toBe("[JS] 5.1. Relaas Panggilan Sidang P (e-Court).rtf");
    expect(relaas["relaas-panggilan-sidang-pertama-ecourt-tergugat"]).toBe("[JS] 5.2. Relaas Panggilan Sidang T (e-Court).rtf");
    expect(relaas["panggilan-ecourt-penggugat"]).toBe("[JS] 5.1. Relaas Panggilan Sidang P (e-Court).rtf");
    expect(relaas["panggilan-ecourt-tergugat"]).toBe("[JS] 5.2. Relaas Panggilan Sidang T (e-Court).rtf");
    expect(relaas["panggilan-ikrar-ecourt"]).toBe("[JS] 7. Relaas Panggilan Ikrar Talak (e-Court).rtf");
    expect(pbt["pbt-ecourt-verstek-tergugat"]).toBe("[JS] 6.2. Relaas Pemberitahuan Putusan Verstek T (e-Court).rtf");
    expect(relaas["amplop-ikrar-tergugat"]).toBe("[JS] 8.3.2. Amplop Relaas Panggilan Ikrar Talak T.rtf");
    // kunci lama tidak berubah: kunci biasa tetap blangko biasa
    expect(relaas["panggilan-ikrar"]).toBe("[JS] 4. Relaas Panggilan Ikrar Talak P dan T.rtf");
    expect(relaas["relaas-panggilan-sidang-pertama-tergugat"]).toBe("[JS] 0. Relaas Panggilan Sidang Pertama T.rtf");
    for (const b of [...bawaanPemetaan("relaas"), ...bawaanPemetaan("pbt")]) expect(FOLDER_SERVER, b.kunci).toContain(b.namaBerkas);
    // semua kunci baku dikenal ekstensi (tak ada yang ditandai asing)
    for (const k of [...KUNCI_BAKU.relaas, ...KUNCI_BAKU.pbt]) expect(uraiKunciRelaas(k.kunci).dikenal, k.kunci).toBe(true);
  });
});

describe("rute cetak (nilaiCetakDokumen) memakai penanda e-Court dari bot", () => {
  const dasar = { perkaraId: 123, golongan: "sidang-pertama", d: 1, pihakDipanggil: "kedua", alurPerkaraId: 15 };

  it("sidang pertama T: e-Court -> 5.2; bukan e-Court atau bot lama -> [JS] 0 T", () => {
    expect(nilaiCetakDokumen({ ...dasar, lewatEcourt: true }).blangko?.berkas).toBe("[JS] 5.2. Relaas Panggilan Sidang T (e-Court).rtf");
    expect(nilaiCetakDokumen({ ...dasar, lewatEcourt: false }).blangko?.berkas).toBe("[JS] 0. Relaas Panggilan Sidang Pertama T.rtf");
    expect(nilaiCetakDokumen({ ...dasar, lewatEcourt: null }).blangko?.berkas).toBe("[JS] 0. Relaas Panggilan Sidang Pertama T.rtf");
    expect(nilaiCetakDokumen({ ...dasar }).blangko?.berkas).toBe("[JS] 0. Relaas Panggilan Sidang Pertama T.rtf");
  });

  it("pemberitahuan putusan verstek T e-Court -> 6.2 dan tetap bisa dicetak", () => {
    const pbt = { perkaraId: 123, golongan: "pemberitahuan-putusan", d: null, pihakDipanggil: "kedua", alurPerkaraId: 15, statusPutusanNama: "Dikabulkan" };
    const n = nilaiCetakDokumen({ ...pbt, lewatEcourt: true, verstekPutusan: true });
    expect(n.blangko?.berkas).toBe("[JS] 6.2. Relaas Pemberitahuan Putusan Verstek T (e-Court).rtf");
    expect(n.bisaDicetak).toBe(true);
    expect(nilaiCetakDokumen({ ...pbt, lewatEcourt: true, verstekPutusan: false }).blangko?.berkas).toBe("[JS] 2. Relaas Pemberitahuan Putusan T.rtf");
  });

  it("pemetaan admin: kunci biasa TIDAK menimpa bawaan e-Court; kunci berkata ecourt menimpanya", () => {
    const peta = { relaas: { "relaas-panggilan-sidang-pertama-tergugat": "admin biasa.rtf" }, pbt: {} };
    expect(nilaiCetakDokumen({ ...dasar, lewatEcourt: true }, null, peta).blangko?.berkas).toBe("[JS] 5.2. Relaas Panggilan Sidang T (e-Court).rtf");
    expect(nilaiCetakDokumen({ ...dasar, lewatEcourt: false }, null, peta).blangko?.berkas).toBe("admin biasa.rtf");
    const petaEc = { relaas: { ...peta.relaas, "relaas-panggilan-sidang-pertama-ecourt-tergugat": "admin ecourt.rtf" }, pbt: {} };
    expect(nilaiCetakDokumen({ ...dasar, lewatEcourt: true }, null, petaEc).blangko?.berkas).toBe("admin ecourt.rtf");
    expect(nilaiCetakDokumen({ ...dasar, lewatEcourt: false }, null, petaEc).blangko?.berkas).toBe("admin biasa.rtf");
  });

  it("ikrar e-Court di perkara yang sudah proses 700: boleh (menu luas); ikrar biasa di luar rentang menu 25 ditolak", () => {
    const ikrar = { perkaraId: 123, golongan: "ikrar-talak", d: 3, pihakDipanggil: "keduanya", alurPerkaraId: 15, prosesTerakhirId: 700, prosesTerakhirNama: "Penetapan hari ikrar" };
    const ec = nilaiCetakDokumen({ ...ikrar, lewatEcourt: true });
    expect(ec.blangko?.berkas).toBe("[JS] 7. Relaas Panggilan Ikrar Talak (e-Court).rtf");
    expect(ec.sebabTidakBisa).not.toMatch(/di luar rentang/);
    const biasa = nilaiCetakDokumen({ ...ikrar, lewatEcourt: false });
    expect(biasa.blangko?.berkas).toBe("[JS] 4. Relaas Panggilan Ikrar Talak P dan T.rtf");
    expect(biasa.sebabTidakBisa).toMatch(/di luar rentang/);
  });

  it("pemecahan dokumen 'keduanya' memakai blangko e-Court per pihak (5.1 dan 5.2 berbeda -> dipecah)", () => {
    const dok = { ...dasar, pihakDipanggil: "keduanya", kunci: "k", lewatEcourt: true };
    const pecah = pecahDokumenPerPihak(dok, {}, {});
    expect(pecah.map((x) => x.pihakDipanggil)).toEqual(["pertama", "kedua"]);
    expect(permintaanUntukDokumen({ ...dasar, lewatEcourt: true })).toMatchObject({ ecourt: true, verstek: false });
    expect(blangkoMenurutPemetaan({ ...dasar, lewatEcourt: true }, { "panggilan-ecourt-tergugat": "x.rtf" }, {})).toBeNull(); // lanjutan, bukan sidang pertama
  });
});

// ============================================================================
// jurusita.js (ekstensi): aturan SAMA dengan portal
// ============================================================================
const EKSTENSI = path.resolve(process.cwd(), "..", "ekstensi-sipp");
const baca = (b: string) => readFileSync(path.join(EKSTENSI, b), "utf8").replace(/\r\n/g, "\n");
const terbuka: JSDOM[] = [];
afterEach(async () => {
  // panel-alat.js memulai pekerjaan asinkron saat dimuat; beri waktu selesai sebelum jendela ditutup (seperti pemetaan-blangko-2okt.test.ts).
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
    ec: (x: unknown) => { ecourt: boolean; verstek: boolean };
  };
}
const polos = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

describe("jurusita.js: aturan e-Court sama dengan portal", () => {
  it("jurusitaUraiKunci = uraiKunciRelaas untuk kunci e-Court/verstek/amplop", () => {
    const j = bukaJurusita();
    for (const k of [
      "relaas-panggilan-sidang-pertama-ecourt-tergugat",
      "Relaas panggilan sidang pertama e-Court penggugat",
      "pbt-ecourt-verstek-tergugat",
      "panggilan-ikrar-ecourt",
      "amplop-putusan-penggugat",
      "panggilan-court-tergugat",
      "panggilan-tergugat",
    ]) {
      const ts = uraiKunciRelaas(k);
      expect(polos(j.urai(k)), k).toEqual({ awalan: ts.awalan, keadaan: ts.keadaan, pihak: ts.pihak, dikenal: ts.dikenal, asing: ts.asing, ecourt: ts.ecourt, verstek: ts.verstek });
    }
  });

  it("jurusitaPilihKunci memilih seperti pilihKunciRelaas bila dokumen e-Court / verstek", () => {
    const j = bukaJurusita();
    const daftar = ["relaas-panggilan-sidang-pertama-tergugat", "relaas-panggilan-sidang-pertama-ecourt-tergugat", "pbt-tergugat", "pbt-ecourt-verstek-tergugat"];
    for (const m of [
      { awalan: "panggilan", keadaan: "pertama", khusus: "tergugat", umum: "tergugat" },
      { awalan: "panggilan", keadaan: "pertama", khusus: "tergugat", umum: "tergugat", ecourt: true },
      { awalan: "pbt", keadaan: "", khusus: "tergugat", umum: "tergugat", ecourt: true },
      { awalan: "pbt", keadaan: "", khusus: "tergugat", umum: "tergugat", ecourt: true, verstek: true },
    ] as PermintaanRelaas[]) {
      expect(j.pilih(daftar, m), JSON.stringify(m)).toBe(pilihKunciRelaas(daftar, m));
    }
  });

  it("jurusitaEcOpsi membaca rincian (lewatEcourt + putusan.verstek) dan dokumen rute (lewatEcourt + verstekPutusan)", () => {
    const j = bukaJurusita();
    expect(polos(j.ec({ lewatEcourt: true, putusan: { verstek: true } }))).toEqual({ ecourt: true, verstek: true });
    expect(polos(j.ec({ lewatEcourt: true, verstekPutusan: true }))).toEqual({ ecourt: true, verstek: true });
    expect(polos(j.ec({ lewatEcourt: null }))).toEqual({ ecourt: false, verstek: false });
    expect(polos(j.ec(null))).toEqual({ ecourt: false, verstek: false });
  });

  it("jurusitaPermintaan + jurusitaPilihBlangko: set e-Court dari bawaan tertanam; tanpa e-Court sama dengan dulu", () => {
    const j = bukaJurusita();
    const seb = j.sebutan("1/Pdt.G/2026/PA.Dgl", "Cerai Gugat", 15, 346);
    const pilih = (g: string, sisi: number, ec?: { ecourt: boolean; verstek: boolean }, peta: unknown = {}) =>
      j.pilihBlangko(peta, g === "pemberitahuan-putusan" ? "pbt" : "relaas", j.minta(g, sisi, seb, ec))?.berkas;
    expect(pilih("sidang-pertama", 1, { ecourt: true, verstek: false })).toBe("[JS] 5.1. Relaas Panggilan Sidang P (e-Court).rtf");
    expect(pilih("sidang-pertama", 2, { ecourt: true, verstek: false })).toBe("[JS] 5.2. Relaas Panggilan Sidang T (e-Court).rtf");
    expect(pilih("sidang-lanjutan", 2, { ecourt: true, verstek: false })).toBe("[JS] 5.2. Relaas Panggilan Sidang T (e-Court).rtf");
    expect(pilih("pemberitahuan-putusan", 2, { ecourt: true, verstek: true })).toBe("[JS] 6.2. Relaas Pemberitahuan Putusan Verstek T (e-Court).rtf");
    expect(pilih("pemberitahuan-putusan", 2, { ecourt: true, verstek: false })).toBe("[JS] 2. Relaas Pemberitahuan Putusan T.rtf");
    expect(pilih("pemberitahuan-putusan", 1, { ecourt: true, verstek: true })).toBe("[JS] 2. Relaas Pemberitahuan Putusan P.rtf");
    expect(pilih("ikrar-talak", 2, { ecourt: true, verstek: false })).toBe("[JS] 7. Relaas Panggilan Ikrar Talak (e-Court).rtf");
    // tanpa e-Court: persis lama
    expect(pilih("sidang-pertama", 2)).toBe("[JS] 0. Relaas Panggilan Sidang Pertama T.rtf");
    expect(pilih("sidang-lanjutan", 1)).toBe("[JS] 1. Relaas Panggilan Sidang P (Sidang Lanjutan).rtf");
    expect(pilih("ikrar-talak", 2)).toBe("[JS] 4. Relaas Panggilan Ikrar Talak P dan T.rtf");
  });

  it("kunci server biasa tidak menimpa bawaan e-Court; kunci server berkata ecourt menimpanya", () => {
    const j = bukaJurusita();
    const seb = j.sebutan("1/Pdt.G/2026/PA.Dgl", "Cerai Gugat", 15, 346);
    const server = (peta: Record<string, string>) => ({ relaas: { peta, sumber: "server" }, pbt: { peta: {}, sumber: "bawaan" } });
    const m = j.minta("sidang-pertama", 2, seb, { ecourt: true, verstek: false });
    expect(j.pilihBlangko(server({ "relaas-panggilan-sidang-pertama-tergugat": "admin biasa.rtf" }), "relaas", m)?.berkas).toBe(
      "[JS] 5.2. Relaas Panggilan Sidang T (e-Court).rtf"
    );
    expect(
      j.pilihBlangko(server({ "relaas-panggilan-sidang-pertama-tergugat": "admin biasa.rtf", "relaas-panggilan-sidang-pertama-ecourt-tergugat": "admin ecourt.rtf" }), "relaas", m)?.berkas
    ).toBe("admin ecourt.rtf");
    const mBiasa = j.minta("sidang-pertama", 2, seb);
    expect(j.pilihBlangko(server({ "relaas-panggilan-sidang-pertama-tergugat": "admin biasa.rtf" }), "relaas", mBiasa)?.berkas).toBe("admin biasa.rtf");
  });
});
