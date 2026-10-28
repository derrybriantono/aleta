// @vitest-environment node
/**
 * ============================================================================
 * 28 OKT 2026 (KETIGA) - RINCIAN ALASAN CERAI (5227): SEBAB KONKRET YANG BELUM DIKENAL KAMUS
 * ============================================================================
 *
 * Kasus nyata (cerai gugat, PA Donggala, disamarkan): posita menyebut perselisihan "yang disebabkan karena Kondisi
 * Penggugat yang mengidap penyakit Stroke membuat Tergugat tidak bisa menerima keadaan Penggugat" dan puncaknya
 * "Tergugat pergi meninggalkan kediaman bersama dengan alasan bekerja namun Penggugat tidak mengetahui tempat tujuan
 * Tergugat". Bot 1.205.54 hanya mengusulkan "Antara Penggugat dan Tergugat terus-menerus terjadi perselisihan dan
 * pertengkaran" (sebab konkret hilang). Perbaikan:
 *   1. pola baru: tidak (bisa/mau) menerima keadaan pihak lain yang sakit/cacat/tidak dapat memberi keturunan (rincian
 *      penyakit di DEPAN perbuatan ikut); pergi meninggalkan kediaman (dengan alasan bekerja) tanpa diketahui tujuannya /
 *      dan tidak kembali / dan putus komunikasi;
 *   2. CADANGAN KUTIP: klausa sebab eksplisit ("yang disebabkan karena ...") yang tidak dikenali kamus dikutip sebagai
 *      butir konkret (ragu), bukan jatuh ke penutup umum - tanpa mengutip sampah.
 */
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

type Apa = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const AKAR = path.resolve(__dirname, "../../..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/routes/internalGatewayRoutes.js"));
const mesin = require_(path.join(AKAR, "aleta_bot/services/deteksi/alasanRincian.js")) as Apa;
const layanan = require_(path.join(AKAR, "aleta_bot/services/abtUsulanService.js")) as Apa;

const CG = { pelaku: "Tergugat", lawan: "Penggugat" };
const CT = { pelaku: "Termohon", lawan: "Pemohon" };
const rinci = (gugatan: string[], extra: Record<string, unknown> = {}) => mesin.deteksiRincian({ gugatan, pihak: CG, ...extra });
const bawaan = (r: Apa) => mesin.pilihanBunyi(r)[0].nilai as string;
const bas = (...b: string[]) => b.map((x) => `- ${x}`).join("\n");

const POSITA_627 = [
  "4. Bahwa sejak bulan Maret 2025 keadaan rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran antara Penggugat dan Tergugat secara terus menerus yang disebabkan karena Kondisi Penggugat yang mengidap penyakit Stroke membuat Tergugat tidak bisa menerima keadaan Penggugat;",
  "5. Bahwa puncak keretakan hubungan rumah tangga Penggugat dengan Tergugat tersebut terjadi pada Juli 2025, Tergugat pergi meninggalkan kediaman bersama dengan alasan bekerja namun Penggugat tidak mengetahui tempat tujuan Tergugat saat itu. Dan tidak lagi terjalin komunikasi antara Penggugat dan Tergugat saat itu sehingga Penggugat dan Tergugat telah pisah rumah selama kurang lebih 10 bulan. Sejak saat itu hak dan kewajiban suami isteri tidak terlaksana sebagaimana mestinya;",
];
const SAKSI_627 = bas(
  "Bahwa yang menjadi penyebab perselisihan dan pertengkaran antara Penggugat dan Tergugat adalah karena kondisi Penggugat yang sakit dan mengalami strok, sehingga Tergugat tidak menerima keadaan Penggugat seperti itu;",
  "Bahwa puncak perselisihan terjadi pada Juli 2025, setelah pertengkaran terjadi Tergugat pamit pergi bekerja namun tidak kembali lagi;",
  "Bahwa yang meninggalkan tempat tinggal bersama adalah Tergugat pamit pergi ke Makassar untuk bekerja, namun tidak balik lagi hingga sekarang;"
);
const BENAR_627 =
  "Tergugat tidak bisa menerima keadaan Penggugat yang mengidap penyakit stroke dan Tergugat pergi meninggalkan tempat kediaman bersama dengan alasan bekerja tanpa diketahui tujuannya";

describe("1. kasus 627: sebab konkret, bukan perselisihan umum", () => {
  it("deteksiRincian langsung: dua butir konkret, perselisihan hanya pilihan di akhir", () => {
    const r = rinci(POSITA_627, { saksi: [{ no: 1, pihak: "penggugat", butir: SAKSI_627.split("\n") }, { no: 2, pihak: "penggugat", butir: SAKSI_627.split("\n") }] });
    expect(r.butir.map((b: Apa) => b.sebab)).toEqual([["tidak-menerima-keadaan"], ["pergi-tanpa-kabar"]]);
    expect(r.butir.every((b: Apa) => !b.penutup)).toBe(true);
    expect(bawaan(r)).toBe(BENAR_627);
    expect(r.butir.map((b: Apa) => b.lencana)).toEqual(["dikuatkan kedua saksi Penggugat", "dikuatkan kedua saksi Penggugat"]);
    // pisah rumah di kalimat berikutnya (melewati titik) tidak ditempel sebagai akibat
    expect(bawaan(r)).not.toMatch(/berpisah|perselisihan|;/);
    expect(mesin.pilihanBunyi(r).some((p: Apa) => p.keadaan === "sesuai gugatan, dengan perselisihan di akhir")).toBe(true);
  });

  it("lewat layanan saksi (opsi rincianAlasan + posita): kartu 5227 memakai sebab konkret, dikuatkan kedua saksi", () => {
    const h = layanan.dariKeteranganSaksi(SAKSI_627, SAKSI_627, "", CG, POSITA_627.join("\n"), { rincianAlasan: true, saksiPihak: { saksi1: "penggugat", saksi2: "penggugat" } });
    const u = h.usulan.find((x: Apa) => x.kode === "5227");
    expect(u.nilai).toBe(BENAR_627);
    expect(u.rincian.map((b: Apa) => b.lencana)).toEqual(["dikuatkan kedua saksi Penggugat", "dikuatkan kedua saksi Penggugat"]);
    expect(u.keyakinan).toBe("cukup");
    expect(u.sumber.filter((s: Apa) => s.saksi > 0).length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(u)).not.toMatch(/aleta/i);
  });
});

describe("2. pola baru dan kerabatnya", () => {
  it("tidak menerima keadaan: rincian di depan perbuatan ikut; di belakang tidak berulang; pihak terbalik ditolak", () => {
    expect(bawaan(rinci(["Bahwa Tergugat tidak mau menerima kekurangan Penggugat."]))).toBe("Tergugat tidak dapat menerima keadaan Penggugat");
    expect(bawaan(rinci(["Bahwa Tergugat tidak dapat menerima Penggugat yang tidak dapat memberikan keturunan."]))).toBe(
      "Tergugat tidak dapat menerima Penggugat yang tidak dapat memberikan keturunan"
    );
    expect(rinci(["Bahwa Penggugat tidak bisa menerima keadaan Tergugat yang lumpuh."]).butir).toHaveLength(0);
    expect(rinci(["Bahwa Tergugat menerima keadaan Penggugat apa adanya."]).butir).toHaveLength(0);
  });

  it("pergi dan tidak kembali / putus komunikasi; pelaku Penggugat ditolak; cerai talak memakai Termohon", () => {
    expect(bawaan(rinci(["Bahwa Tergugat pamit pergi ke Kalimantan untuk bekerja namun tidak pernah kembali lagi."]))).toBe(
      "Tergugat pergi meninggalkan tempat kediaman bersama untuk bekerja dan tidak kembali lagi"
    );
    expect(bawaan(rinci(["Bahwa Tergugat pergi meninggalkan rumah dan tidak ada lagi komunikasi dengan Penggugat."]))).toBe(
      "Tergugat pergi meninggalkan tempat kediaman bersama dan tidak lagi berkomunikasi dengan Penggugat"
    );
    expect(rinci(["Bahwa Penggugat pergi ke rumah orang tua dan tidak kembali."]).butir).toHaveLength(0);
    const ct = mesin.deteksiRincian({ gugatan: ["Bahwa Termohon pergi meninggalkan rumah tanpa memberitahu tujuannya."], pihak: CT });
    expect(bawaan(ct)).toBe("Termohon pergi meninggalkan tempat kediaman bersama tanpa diketahui tujuannya");
  });

  it("'tanpa diketahui tujuannya' menyerap 'tidak diketahui keberadaannya' (tidak diulang)", () => {
    const r = rinci(["Bahwa Tergugat pergi meninggalkan rumah tanpa memberitahu tujuannya dan hingga kini tidak diketahui keberadaannya."]);
    expect(r.butir).toHaveLength(1);
    expect(r.butir[0].sebab).toEqual(["pergi-tanpa-kabar"]);
  });
});

describe("3. cadangan kutip: klausa sebab eksplisit yang belum dikenal kamus", () => {
  it("dikutip sebagai butir konkret, keyakinan ragu, catatan meminta diperiksa", () => {
    const r = rinci(["Bahwa sejak 2024 sering terjadi pertengkaran antara Penggugat dan Tergugat yang disebabkan karena Tergugat lebih mementingkan hobi memancing daripada keluarga;"]);
    expect(r.butir).toHaveLength(1);
    expect(r.butir[0].penutup).toBe(false);
    expect(bawaan(r)).toBe("Tergugat lebih mementingkan hobi memancing daripada keluarga");
    expect(r.butir[0].yakin).toBe("ragu");
    expect(r.butir[0].catatan).toMatch(/dikutip dari gugatan/);
  });

  it("huruf awal kecil (bukan sebutan pihak), ujung 'sehingga ... pertengkaran' dibuang, 'namun <pihak>' ikut", () => {
    expect(bawaan(rinci(["Bahwa rumah tangga mulai tidak harmonis dikarenakan Masalah ekonomi keluarga sehingga sering terjadi pertengkaran;"]))).toBe("masalah ekonomi keluarga");
    expect(bawaan(rinci(["Bahwa rumah tangga tidak harmonis dikarenakan Tergugat terlalu sibuk mengurus ternak sapi sehingga sering terjadi pertengkaran;"]))).toBe(
      "Tergugat terlalu sibuk mengurus ternak sapi"
    );
    const ct = mesin.deteksiRincian({
      gugatan: ["Bahwa sering terjadi perselisihan yang disebabkan karena Pemohon telah memberikan nafkah dari hasil bertani namun Termohon tidak bersyukur;"],
      pihak: CT,
    });
    expect(bawaan(ct)).toBe("Pemohon telah memberikan nafkah dari hasil bertani namun Termohon tidak bersyukur");
  });

  it("dikuatkan saksi bila keterangannya memuat kata isi kutipan", () => {
    const r = rinci(["Bahwa sering terjadi pertengkaran yang disebabkan karena Tergugat lebih mementingkan hobi memancing daripada keluarga;"], {
      saksi: [{ no: 1, pihak: "penggugat", butir: ["Tergugat setiap hari pergi memancing dan lebih mementingkan hobinya"] }, { no: 2, pihak: "penggugat", butir: ["saksi tidak tahu"] }],
    });
    expect(r.butir[0].lencana).toBe("dikuatkan satu saksi (saksi Penggugat)");
  });

  it("tidak mengutip sampah", () => {
    const umum = (g: string) => {
      const r = rinci([g]);
      return r.butir.length === 1 && r.butir[0].penutup;
    };
    expect(umum("Bahwa sering terjadi perselisihan karena hal tersebut;")).toBe(true);
    expect(umum("Bahwa sering terjadi perselisihan dan pertengkaran yang disebabkan antara lain sebagai berikut:")).toBe(true);
    expect(umum("Bahwa terjadi pertengkaran karena Penggugat dan Tergugat selalu bertengkar;")).toBe(true);
    expect(umum("Bahwa oleh karena itu rumah tangga Penggugat dan Tergugat tidak harmonis lagi;")).toBe(true);
    expect(umum("Bahwa sering terjadi pertengkaran karena pada bulan Juli 2022 Penggugat berkunjung ke rumah orang tua;")).toBe(true);
    // penanda sebab menerangkan kepergian/pisah rumah, bukan perselisihannya
    expect(umum("Bahwa rumah tangga tidak harmonis dan Penggugat dan Tergugat telah berpisah tempat tinggal karena Penggugat telah pergi meninggalkan tempat kediaman bersama;")).toBe(
      true
    );
    // cerita perbuatan pihak yang mengajukan sendiri bukan sebab
    expect(umum("Bahwa sering terjadi pertengkaran karena Penggugat meminta izin membantu tetangga yang sedang pesta;")).toBe(true);
    // kutipan norma dan kesimpulan tidak dikutip
    expect(rinci(["Bahwa karena keadaan tersebut, Penggugat mengajukan gugatan cerai ke Pengadilan Agama;"]).butir).toHaveLength(0);
    // sebab yang SUDAH dikenali kamus tidak dikutip ulang
    const judi = rinci(["Bahwa sering terjadi perselisihan dan pertengkaran karena Tergugat sering berjudi;"]);
    expect(judi.butir.map((b: Apa) => b.sebab)).toEqual([["judi"]]);
  });
});
