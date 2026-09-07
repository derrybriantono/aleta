// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require_ = createRequire(import.meta.url);
const { satukanPetugas, kunciNama } = require_(
  path.resolve(process.cwd(), "../aleta_bot/services/petugasPerkaraUtil.js")
) as {
  satukanPetugas: (baris: unknown[]) => { nama: string; kode: string };
  kunciNama: (nama: string) => string;
};

/**
 * Penyatuan petugas perkara dari baris SIPP.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Dua cacat yang terlihat di layar jadwal sidang, keduanya berasal dari bentuk
 * data SIPP yang sesungguhnya - contoh di bawah disalin apa adanya dari
 * PA Donggala, bukan dikarang:
 *
 *   1. "JS: Mohammad Syukri, S.H., Mohammad Syukri" - satu orang tampak dua,
 *      karena SIPP menyimpan dua baris aktif dengan ejaan gelar berbeda;
 *   2. kolom Majelis berbunyi "—" pada SELURUH perkara ikrar talak, karena
 *      baris hakim yang aktif justru berkode NULL sedangkan kodenya ada di
 *      baris yang tidak aktif.
 *
 * Keduanya tidak menghasilkan galat apa pun. Yang pertama membuat pembaca
 * jadwal menyangka ada dua jurusita; yang kedua menyembunyikan susunan majelis
 * pada perkara yang justru sedang menuju ikrar talak.
 */

describe("nama kembar disatukan, ejaan terlengkap yang menang", () => {
  it("dua baris aktif dengan ejaan gelar berbeda menjadi satu", () => {
    // perkara_jurusita 9587 - apa adanya dari SIPP.
    const hasil = satukanPetugas([
      { nama: "Mohammad Syukri", kode: "", urutan: 1, aktif: "Y" },
      { nama: "Mohammad Syukri, S.H.", kode: "", urutan: 1, aktif: "Y" },
    ]);
    expect(hasil.nama).toBe("Mohammad Syukri, S.H.");
  });

  it("baris kembar persis menjadi satu", () => {
    // perkara_jurusita 9898 - "Mustini" tercatat dua kali.
    expect(
      satukanPetugas([
        { nama: "Mustini", kode: "", urutan: 1, aktif: "Y" },
        { nama: "Mustini", kode: "", urutan: 1, aktif: "Y" },
      ]).nama
    ).toBe("Mustini");
  });

  it("panitera kembar persis menjadi satu", () => {
    // perkara_panitera_pn 9587.
    expect(
      satukanPetugas([
        { nama: "Sri Susilowati, S.H.", kode: "", urutan: 1, aktif: "Y" },
        { nama: "Sri Susilowati, S.H.", kode: "", urutan: 1, aktif: "Y" },
      ]).nama
    ).toBe("Sri Susilowati, S.H.");
  });

  it("dua orang yang BERBEDA tidak ikut disatukan", () => {
    // Penyatuan yang terlalu bersemangat jauh lebih berbahaya daripada nama
    // kembar: ia MENGHILANGKAN petugas dari naskah.
    const hasil = satukanPetugas([
      { nama: "Mustini", kode: "", urutan: 1, aktif: "Y" },
      { nama: "Tanty Restianty", kode: "", urutan: 2, aktif: "Y" },
    ]);
    expect(hasil.nama).toBe("Mustini, Tanty Restianty");
  });

  it("nama mirip tetapi bukan orang yang sama tetap terpisah", () => {
    const hasil = satukanPetugas([
      { nama: "Sri Susilowati, S.H.", kode: "", urutan: 1, aktif: "Y" },
      { nama: "Sri Wahyuni, S.H.", kode: "", urutan: 2, aktif: "Y" },
    ]);
    expect(hasil.nama).toBe("Sri Susilowati, S.H., Sri Wahyuni, S.H.");
  });
});

describe("kode majelis pada perkara ikrar talak", () => {
  it("kode diambil dari baris tidak aktif ketika baris aktif berkode NULL", () => {
    // perkara_hakim_pn 9587 - apa adanya dari SIPP.
    const hasil = satukanPetugas([
      { nama: "Himawan Tatura Wijaya, S.H.I.,M.H.", kode: "C1", urutan: 1, aktif: "T" },
      { nama: "Himawan Tatura Wijaya, S.H.I.,M.H.", kode: null, urutan: 1, aktif: "Y" },
      { nama: "Idris, S.H.I., M.H.", kode: "C2", urutan: 2, aktif: "T" },
      { nama: "Idris, S.H.I., M.H.", kode: null, urutan: 2, aktif: "Y" },
      { nama: "Derry Briantono, S.H.", kode: "C3", urutan: 3, aktif: "T" },
      { nama: "Derry Briantono, S.H.", kode: null, urutan: 3, aktif: "Y" },
    ]);
    expect(hasil.kode).toBe("C1-C2-C3");
    expect(hasil.nama).toBe(
      "Himawan Tatura Wijaya, S.H.I.,M.H., Idris, S.H.I., M.H., Derry Briantono, S.H."
    );
  });

  it("perkara biasa yang barisnya sudah rapi tidak berubah", () => {
    // perkara_hakim_pn 10022 - hanya baris aktif, seluruhnya berkode.
    const hasil = satukanPetugas([
      { nama: "Himawan Tatura Wijaya, S.H.I.,M.H.", kode: "C1", urutan: 1, aktif: "Y" },
      { nama: "Idris, S.H.I., M.H.", kode: "C2", urutan: 2, aktif: "Y" },
      { nama: "Derry Briantono, S.H.", kode: "C3", urutan: 3, aktif: "Y" },
    ]);
    expect(hasil.kode).toBe("C1-C2-C3");
  });

  it("urutan majelis dipertahankan, bukan urutan baris", () => {
    const hasil = satukanPetugas([
      { nama: "Derry Briantono, S.H.", kode: "C3", urutan: 3, aktif: "Y" },
      { nama: "Himawan Tatura Wijaya, S.H.I.,M.H.", kode: "C1", urutan: 1, aktif: "Y" },
      { nama: "Idris, S.H.I., M.H.", kode: "C2", urutan: 2, aktif: "Y" },
    ]);
    expect(hasil.kode).toBe("C1-C2-C3");
  });
});

describe("baris aktif yang menentukan siapa bertugas", () => {
  it("panitera lama yang sudah tidak aktif TIDAK ikut tampil", () => {
    // perkara_panitera_pn 9587: "Sri Wahyuni" aktif=T, "Sri Susilowati" aktif=Y.
    const hasil = satukanPetugas([
      { nama: "Sri Wahyuni, S.H.", kode: "", urutan: 1, aktif: "T" },
      { nama: "Sri Susilowati, S.H.", kode: "", urutan: 1, aktif: "Y" },
    ]);
    expect(hasil.nama).toBe("Sri Susilowati, S.H.");
  });

  it("tanpa satu pun baris aktif, yang pernah bertugas tetap ditampilkan", () => {
    // Menampilkan majelis yang pernah memeriksa jauh lebih berguna daripada
    // menampilkan tanda hubung pada perkara yang sudah selesai.
    const hasil = satukanPetugas([
      { nama: "Himawan Tatura Wijaya, S.H.I.,M.H.", kode: "C1", urutan: 1, aktif: "T" },
    ]);
    expect(hasil.nama).toBe("Himawan Tatura Wijaya, S.H.I.,M.H.");
    expect(hasil.kode).toBe("C1");
  });
});

describe("keadaan batas", () => {
  it("tanpa baris sama sekali menghasilkan kosong, bukan galat", () => {
    expect(satukanPetugas([])).toEqual({ nama: "", kode: "" });
    expect(satukanPetugas(undefined as never)).toEqual({ nama: "", kode: "" });
  });

  it("baris tanpa nama dibuang", () => {
    expect(satukanPetugas([{ nama: "", kode: "C1", urutan: 1, aktif: "Y" }]).nama).toBe("");
  });

  it("nama dengan ruang berlebih tetap dibandingkan sebagai orang yang sama", () => {
    expect(kunciNama("Mohammad Syukri, S.H.")).toBe(kunciNama("Mohammad  Syukri"));
  });
});
