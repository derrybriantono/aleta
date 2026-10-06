// @vitest-environment node
import { readFileSync } from "node:fs";
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
  it("tanpa baris sama sekali menghasilkan kosong, bukan error", () => {
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

// ---------------------------------------------------------------------------
// KEDUDUKAN PIHAK - SAKSI DAN TURUT TERGUGAT BUKAN PENGGUGAT
// ---------------------------------------------------------------------------

/**
 * Salinan aturan pengelompokan dari sippJadwalSidangService.pihakBanyakPerkara.
 *
 * ==========================================================================
 * CACAT YANG DIJAGA DI SINI
 * ==========================================================================
 *
 * Aturan lama berbunyi "pihak_ke 2 masuk tergugat, SELURUH SISANYA masuk
 * penggugat". Pengukuran v_pihak_perkara di PA Donggala menunjukkan akibatnya:
 *
 *   pihak_ke 1  Pemohon / Penggugat        14.268  benar
 *   pihak_ke 2  Tergugat / Termohon         5.846  benar
 *   pihak_ke 4  TURUT TERGUGAT                 27  masuk penggugat - SISI LAWAN
 *   pihak_ke 5  SAKSI                      16.480  masuk penggugat
 *
 * Saksi lebih banyak daripada penggugatnya sendiri, sehingga hampir setiap
 * perkara tampak berpenggugat tiga orang.
 *
 * Yang terkena bukan hanya layar jadwal: daftar yang sama dipakai CETAK jadwal
 * sidang, layar antrian ruang tunggu, dan papan pintu ruang sidang - naskah
 * dan layar yang dibaca para pihak sendiri.
 */
function kelompokkanPihak(
  baris: Array<{ nama: string; pihakKe: number }>
): { penggugat: string[]; tergugat: string[]; saksi: string[]; lain: string[] } {
  const hasil = { penggugat: [] as string[], tergugat: [] as string[], saksi: [] as string[], lain: [] as string[] };
  for (const x of baris) {
    const nama = String(x.nama || "").trim();
    if (!nama) continue;
    const kedudukan = Number(x.pihakKe);
    if (kedudukan === 1) hasil.penggugat.push(nama);
    else if (kedudukan === 2 || kedudukan === 4) hasil.tergugat.push(nama);
    else if (kedudukan === 5) hasil.saksi.push(nama);
    else hasil.lain.push(nama);
  }
  return hasil;
}

describe("saksi tidak pernah terhitung sebagai penggugat", () => {
  it("perkara 9984 - apa adanya dari v_pihak_perkara", () => {
    // Inilah baris yang membuat layar berbunyi "Karmila binti Bustamin +2":
    // Arfan dan Arpia adalah SAKSI, bukan penggugat kedua dan ketiga.
    const hasil = kelompokkanPihak([
      { nama: "Karmila binti Bustamin", pihakKe: 1 },
      { nama: "Andika Rafliando bin Syarifuddin R. Gasing", pihakKe: 2 },
      { nama: "Arfan bin Sudin", pihakKe: 5 },
      { nama: "Arpia binti Haledu", pihakKe: 5 },
    ]);
    expect(hasil.penggugat).toEqual(["Karmila binti Bustamin"]);
    expect(hasil.tergugat).toEqual(["Andika Rafliando bin Syarifuddin R. Gasing"]);
    expect(hasil.saksi).toEqual(["Arfan bin Sudin", "Arpia binti Haledu"]);
  });

  it("turut tergugat berada di sisi TERGUGAT, bukan penggugat", () => {
    // Menaruhnya di penggugat membalik kedudukannya pada naskah yang dibaca
    // para pihak - dan naskah itu ikut dicetak.
    const hasil = kelompokkanPihak([
      { nama: "Penggugat A", pihakKe: 1 },
      { nama: "Tergugat B", pihakKe: 2 },
      { nama: "Turut Tergugat C", pihakKe: 4 },
    ]);
    expect(hasil.penggugat).toEqual(["Penggugat A"]);
    expect(hasil.tergugat).toEqual(["Tergugat B", "Turut Tergugat C"]);
  });

  it("perkara berpenggugat banyak TETAP menyebut semuanya", () => {
    // Perbaikan ini tidak boleh menghapus penggugat yang memang lebih dari
    // satu - itu keadaan yang sah dan menentukan berapa relaas yang harus ada.
    const hasil = kelompokkanPihak([
      { nama: "Pemohon I", pihakKe: 1 },
      { nama: "Pemohon II", pihakKe: 1 },
      { nama: "Saksi X", pihakKe: 5 },
    ]);
    expect(hasil.penggugat).toEqual(["Pemohon I", "Pemohon II"]);
    expect(hasil.saksi).toEqual(["Saksi X"]);
  });

  it("kedudukan yang tidak dikenali TIDAK dibuang ke salah satu sisi", () => {
    // Itulah kekeliruan yang sedang diperbaiki; mengulanginya untuk nilai baru
    // hanya menunda kejadian yang sama.
    const hasil = kelompokkanPihak([{ nama: "Kedudukan Baru", pihakKe: 9 }]);
    expect(hasil.penggugat).toEqual([]);
    expect(hasil.tergugat).toEqual([]);
    expect(hasil.lain).toEqual(["Kedudukan Baru"]);
  });

  it("baris tanpa nama dibuang, bukan menjadi baris kosong", () => {
    expect(kelompokkanPihak([{ nama: "", pihakKe: 1 }]).penggugat).toEqual([]);
  });
});

describe("aturan di layanan bot sama dengan salinan di uji ini", () => {
  it("penggolongan pihak_ke ada apa adanya di berkas sumber", () => {
    const berkas = path.resolve(process.cwd(), "../aleta_bot/services/sippJadwalSidangService.js");
    const isi = readFileSync(berkas, "utf8");
    // Kalau salah satu cabang dihapus, saksi atau turut tergugat kembali
    // tercampur ke penggugat - tanpa galat, dan tanpa uji lain yang menuduh.
    expect(isi).toContain("if (kedudukan === 1) hasil[kunci].penggugat.push(nama);");
    // 6 Okt 2026 (butir 23): turut tergugat SELALU juga di turutTergugat, dan
    // tetap di tergugat bagi pemakai lama (tanpa pisahkanTurut); intervensi
    // (pihak_ke 3) tersendiri.
    expect(isi).toContain("else if (kedudukan === 4) {");
    expect(isi).toContain("hasil[kunci].turutTergugat.push(nama);");
    expect(isi).toContain("if (!pisahkanTurut) hasil[kunci].tergugat.push(nama);");
    expect(isi).toContain("} else if (kedudukan === 2) hasil[kunci].tergugat.push(nama);");
    expect(isi).toContain("else if (kedudukan === 3) hasil[kunci].intervensi.push(nama);");
    expect(isi).toContain("else if (kedudukan === 5) hasil[kunci].saksi.push(nama);");
    expect(isi).toContain("else hasil[kunci].lain.push(nama);");
  });
});
