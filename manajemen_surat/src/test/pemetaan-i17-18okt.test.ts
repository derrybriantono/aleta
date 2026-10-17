// @vitest-environment node
/**
 * ============================================================================
 * PEMETAAN PAKET CELAH PUTUSAN (I17, 18 Okt): abt-putusan-celah-gugatan-derry (37), -kumulasi-derry (38), -permohonan-derry (31)
 * ============================================================================
 *
 * Paket (BELUM terpasang di server; 106 berkas baru di folder yang sudah ada, tanpa menu/folder baru). Yang dijaga:
 *   (A) pohon: 106 berkas ada di fixture; tiap berkas paket DIJANGKAU peta bawaan (sebagai pilihan utama atau "varian") di folder menunya;
 *   (B) keadaan baru di lib/keadaan-putusan.ts: sesudah-jawaban, cacat-formil, kurang-pihak, alamat-t-tidak-diketahui, itsbat-kabul-cerai-ditolak,
 *       kontensius-verstek (+ penanda kumulasi-itsbat / kumulasi-hak-asuh), konservatif;
 *   (C) pemilihan blangko: gugatan (HB, kewarisan, hak asuh, pembatalan, IN kontensius, cerai), cerai kumulasi 1c / 1d, permohonan;
 *   (D) bawaan lama tidak berubah; (E) TS = panel-alat.js untuk baris kumulasi berkeadaan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

import { itsbatKabulCeraiDitolakDariAmar, keadaanPutusan } from "@/lib/keadaan-putusan";
import { FOLDER_MENU_PUTUSAN, PETA_PUTUSAN_BAWAAN, masukanRekomendasiDariBaris, pilihPutusanBawaan, rekomendasiBlangko } from "@/lib/rekomendasi-blangko";

const FIX = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "blangko-derry-server-17okt.json"), "utf8")) as { berkas: string[] };
const A = "derry_briantono/";
/** 106 berkas paket (folder/nama.rtf) menurut i17-putusan-celah/PEMETAAN-ALETA.md. */
const BARU_I17 = [
  "4a Harta Bersama/[01b] [Kabul Verstek] HB.rtf",
  "4a Harta Bersama/[03] [Tolak] HB - Kontradiktoir - Objek Bukan Harta Bersama.rtf",
  "4a Harta Bersama/[03b] [Tolak Verstek] HB - Objek Bukan Harta Bersama.rtf",
  "4a Harta Bersama/[98b] [Cabut] HB - Sesudah Jawaban dengan Persetujuan T.rtf",
  "4a Harta Bersama/[98a] [Gugur] HB - P Tidak Hadir Sidang Pertama.rtf",
  "4a Harta Bersama/[98c] [Coret] HB - Dibatalkan dari Pendaftaran - Panjar Habis.rtf",
  "4a Harta Bersama/[99] [NO] HB - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022).rtf",
  "4a Harta Bersama/[99a] [NO] HB - Kurang Pihak (Plurium Litis Consortium).rtf",
  "4a Harta Bersama/[99b] [NO] HB - Gugatan Kabur (Obscuur Libel).rtf",
  "4b Kewarisan/[01a] [Kabul] Kewarisan - T Tidak Hadir Setelah Mediasi.rtf",
  "4b Kewarisan/[01b] [Kabul Verstek] Kewarisan.rtf",
  "4b Kewarisan/[03] [Tolak] Kewarisan - Kontradiktoir - Dalil Tidak Terbukti.rtf",
  "4b Kewarisan/[03b] [Tolak Verstek] Kewarisan - Dalil Tidak Terbukti.rtf",
  "4b Kewarisan/[98] [Cabut] Kewarisan - P & T Hadir Sebelum Jawaban.rtf",
  "4b Kewarisan/[98a] [Gugur] Kewarisan - P Tidak Hadir Sidang Pertama.rtf",
  "4b Kewarisan/[98b] [Cabut] Kewarisan - Sesudah Jawaban dengan Persetujuan T.rtf",
  "4b Kewarisan/[98c] [Coret] Kewarisan - Dibatalkan dari Pendaftaran - Panjar Habis.rtf",
  "4b Kewarisan/[99] [NO] Kewarisan - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022).rtf",
  "4b Kewarisan/[99a] [NO] Kewarisan - Kurang Pihak (Plurium Litis Consortium).rtf",
  "4b Kewarisan/[99b] [NO] Kewarisan - Gugatan Kabur (Obscuur Libel).rtf",
  "6a Hak Asuh Anak (Hadhanah)/[98b] [Cabut] Gugatan - Sesudah Jawaban dengan Persetujuan T.rtf",
  "6a Hak Asuh Anak (Hadhanah)/[98c] [Coret] Gugatan - Dibatalkan dari Pendaftaran - Panjar Habis.rtf",
  "6a Hak Asuh Anak (Hadhanah)/[99a] [NO] Gugatan - Kurang Pihak (Plurium Litis Consortium).rtf",
  "6a Hak Asuh Anak (Hadhanah)/[99b] [NO] Gugatan - Gugatan Kabur (Obscuur Libel).rtf",
  "5a Pembatalan Perkawinan/[03b] [Tolak Verstek] Pembatalan Perkawinan - Alasan Pembatalan Tidak Terbukti.rtf",
  "5a Pembatalan Perkawinan/[98b] [Cabut] Pembatalan Perkawinan - Sesudah Jawaban dengan Persetujuan T.rtf",
  "5a Pembatalan Perkawinan/[98c] [Coret] Pembatalan Perkawinan - Dibatalkan dari Pendaftaran - Panjar Habis.rtf",
  "5a Pembatalan Perkawinan/[99a] [NO] Pembatalan Perkawinan - Kurang Pihak (Plurium Litis Consortium).rtf",
  "5a Pembatalan Perkawinan/[99b] [NO] Pembatalan Perkawinan - Gugatan Kabur (Obscuur Libel).rtf",
  "2a Itsbat Nikah Kontensius/[03] [Tolak] IN Kontensius - Kontradiktoir - Rukun dan Syarat Tidak Terbukti.rtf",
  "2a Itsbat Nikah Kontensius/[03b] [Tolak Verstek] IN Kontensius - Rukun dan Syarat Tidak Terbukti.rtf",
  "2a Itsbat Nikah Kontensius/[98a] [Gugur] IN Kontensius - P Tidak Hadir Sidang Pertama.rtf",
  "2a Itsbat Nikah Kontensius/[98b] [Cabut] IN Kontensius - Sesudah Jawaban dengan Persetujuan T.rtf",
  "2a Itsbat Nikah Kontensius/[98c] [Coret] IN Kontensius - Dibatalkan dari Pendaftaran - Panjar Habis.rtf",
  "2a Itsbat Nikah Kontensius/[99a] [NO] IN Kontensius - Kurang Pihak (Ahli Waris Lain Tidak Ditarik).rtf",
  "2a Itsbat Nikah Kontensius/[99b] [NO] IN Kontensius - Gugatan Kabur (Obscuur Libel).rtf",
  "2a Itsbat Nikah Kontensius/[01b] [Kabul Verstek] IN Kontensius - Pasangan Meninggal, Ahli Waris Tidak Hadir.rtf",
  "1c Perceraian Kumulasi Itsbat Nikah/[01c] [Kabul] Putusan CG Kumulasi Itsbat Nikah - T Tidak Hadir Setelah Mediasi.rtf",
  "1c Perceraian Kumulasi Itsbat Nikah/[02] [Kabul] Putusan CG Kumulasi Itsbat Nikah - Kontradiktoir.rtf",
  "1c Perceraian Kumulasi Itsbat Nikah/[03] [Tolak] Putusan CG Kumulasi Itsbat Nikah - Itsbat Kabul, Cerai Ditolak (Kontradiktoir).rtf",
  "1c Perceraian Kumulasi Itsbat Nikah/[98] [Cabut] Putusan CG Kumulasi Itsbat Nikah - P & T Hadir Sebelum Jawaban.rtf",
  "1c Perceraian Kumulasi Itsbat Nikah/[98a] [Gugur] Putusan CG Kumulasi Itsbat Nikah - P & T Tidak Hadir.rtf",
  "1c Perceraian Kumulasi Itsbat Nikah/[98d] [Gugur] Putusan CG Kumulasi Itsbat Nikah - P Tidak Hadir T Hadir.rtf",
  "1c Perceraian Kumulasi Itsbat Nikah/[98c] [Coret] Putusan CG Kumulasi Itsbat Nikah - Dibatalkan dari Pendaftaran - Panjar Habis.rtf",
  "1c Perceraian Kumulasi Itsbat Nikah/[99] [NO] Putusan CG Kumulasi Itsbat Nikah - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022).rtf",
  "1c Perceraian Kumulasi Itsbat Nikah/[99c] [NO] Putusan CG Kumulasi Itsbat Nikah - Alamat T Tidak Diketahui.rtf",
  "1c Perceraian Kumulasi Itsbat Nikah/[98b] [Cabut] Putusan CG Kumulasi Itsbat Nikah - Sesudah Jawaban dengan Persetujuan T.rtf",
  "1c Perceraian Kumulasi Itsbat Nikah/[99b] [NO] Putusan CG Kumulasi Itsbat Nikah - Kontradiktoir - Cacat Formil Gugatan.rtf",
  "1c Perceraian Kumulasi Itsbat Nikah/[01c] [Kabul] Putusan CT Kumulasi Itsbat Nikah - T Tidak Hadir Setelah Mediasi.rtf",
  "1c Perceraian Kumulasi Itsbat Nikah/[02] [Kabul] Putusan CT Kumulasi Itsbat Nikah - Kontradiktoir.rtf",
  "1c Perceraian Kumulasi Itsbat Nikah/[03] [Tolak] Putusan CT Kumulasi Itsbat Nikah - Itsbat Kabul, Cerai Ditolak (Kontradiktoir).rtf",
  "1c Perceraian Kumulasi Itsbat Nikah/[98] [Cabut] Putusan CT Kumulasi Itsbat Nikah - P & T Hadir Sebelum Jawaban.rtf",
  "1c Perceraian Kumulasi Itsbat Nikah/[98a] [Gugur] Putusan CT Kumulasi Itsbat Nikah - P & T Tidak Hadir.rtf",
  "1c Perceraian Kumulasi Itsbat Nikah/[98d] [Gugur] Putusan CT Kumulasi Itsbat Nikah - P Tidak Hadir T Hadir.rtf",
  "1c Perceraian Kumulasi Itsbat Nikah/[98c] [Coret] Putusan CT Kumulasi Itsbat Nikah - Dibatalkan dari Pendaftaran - Panjar Habis.rtf",
  "1c Perceraian Kumulasi Itsbat Nikah/[99] [NO] Putusan CT Kumulasi Itsbat Nikah - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022).rtf",
  "1c Perceraian Kumulasi Itsbat Nikah/[99c] [NO] Putusan CT Kumulasi Itsbat Nikah - Alamat T Tidak Diketahui.rtf",
  "1c Perceraian Kumulasi Itsbat Nikah/[98b] [Cabut] Putusan CT Kumulasi Itsbat Nikah - Sesudah Jawaban dengan Persetujuan T.rtf",
  "1c Perceraian Kumulasi Itsbat Nikah/[99b] [NO] Putusan CT Kumulasi Itsbat Nikah - Kontradiktoir - Cacat Formil Gugatan.rtf",
  "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[01c] [Kabul] Putusan CG Kumulasi Hak Asuh Anak - T Tidak Hadir Setelah Mediasi.rtf",
  "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[02] [Kabul] Putusan CG Kumulasi Hak Asuh Anak - Kontradiktoir.rtf",
  "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[01d] [Kabul] Putusan CG Kumulasi Hak Asuh dan Nafkah Anak - T Tidak Hadir Setelah Mediasi.rtf",
  "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[02b] [Kabul] Putusan CG Kumulasi Hak Asuh dan Nafkah Anak - Kontradiktoir.rtf",
  "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[98] [Cabut] Putusan CG Kumulasi Hak Asuh Anak - P & T Hadir Sebelum Jawaban.rtf",
  "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[98a] [Gugur] Putusan CG Kumulasi Hak Asuh Anak - P & T Tidak Hadir.rtf",
  "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[98d] [Gugur] Putusan CG Kumulasi Hak Asuh Anak - P Tidak Hadir T Hadir.rtf",
  "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[98c] [Coret] Putusan CG Kumulasi Hak Asuh Anak - Dibatalkan dari Pendaftaran - Panjar Habis.rtf",
  "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[99] [NO] Putusan CG Kumulasi Hak Asuh Anak - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022).rtf",
  "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[99c] [NO] Putusan CG Kumulasi Hak Asuh Anak - Alamat T Tidak Diketahui.rtf",
  "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[98b] [Cabut] Putusan CG Kumulasi Hak Asuh Anak - Sesudah Jawaban dengan Persetujuan T.rtf",
  "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[99b] [NO] Putusan CG Kumulasi Hak Asuh Anak - Kontradiktoir - Cacat Formil Gugatan.rtf",
  "1 Perceraian CG/[98] [Cabut] 7. Cerai P & T Hadir - Sesudah Jawaban dengan Persetujuan T.rtf",
  "1 Perceraian CG/[98] [NO] 8. Cerai P & T Hadir - Kontradiktoir - Cacat Formil Gugatan.rtf",
  "1a Perceraian CT/[98] [Cabut] 7. Cerai P & T Hadir - Sesudah Jawaban dengan Persetujuan T.rtf",
  "1a Perceraian CT/[98] [NO] 8. Cerai P & T Hadir - Kontradiktoir - Cacat Formil Permohonan.rtf",
  "2 Itsbat Nikah/[99a] [NO] IN - Pemohon Tidak Hadir Lagi (SEMA 1 2022).rtf",
  "2 Itsbat Nikah/[98c] [Coret] IN - Dibatalkan dari Pendaftaran - Panjar Habis.rtf",
  "3 Dispensasi Kawin/[98a] [Gugur] DK - Pemohon Tidak Pernah Hadir.rtf",
  "3 Dispensasi Kawin/[98c] [Coret] DK - Dibatalkan dari Pendaftaran - Panjar Habis.rtf",
  "5 Izin Poligami/[03] [Tolak] Izin Poligami - Syarat Tidak Terbukti.rtf",
  "5 Izin Poligami/[98a] [Gugur] Izin Poligami - Pemohon Tidak Pernah Hadir.rtf",
  "5 Izin Poligami/[99] [NO] Izin Poligami - Pemohon Tidak Hadir Lagi (SEMA 1 2022).rtf",
  "5 Izin Poligami/[98c] [Coret] Izin Poligami - Dibatalkan dari Pendaftaran - Panjar Habis.rtf",
  "6 Perwalian/[98] [Cabut] Perwalian.rtf",
  "6 Perwalian/[98a] [Gugur] Perwalian - Pemohon Tidak Pernah Hadir.rtf",
  "6 Perwalian/[99] [NO] Perwalian - Pemohon Tidak Hadir Lagi (SEMA 1 2022).rtf",
  "6 Perwalian/[98c] [Coret] Perwalian - Dibatalkan dari Pendaftaran - Panjar Habis.rtf",
  "7 Wali Adhal/[98a] [Gugur] Wali Adhal - Pemohon Tidak Pernah Hadir.rtf",
  "7 Wali Adhal/[99] [NO] Wali Adhal - Pemohon Tidak Hadir Lagi (SEMA 1 2022).rtf",
  "7 Wali Adhal/[98c] [Coret] Wali Adhal - Dibatalkan dari Pendaftaran - Panjar Habis.rtf",
  "8 Asal Usul Anak/[03] [Tolak] AUA - Dalil Tidak Terbukti.rtf",
  "8 Asal Usul Anak/[98a] [Gugur] AUA - Pemohon Tidak Pernah Hadir.rtf",
  "8 Asal Usul Anak/[99a] [NO] AUA - Pemohon Tidak Hadir Lagi (SEMA 1 2022).rtf",
  "8 Asal Usul Anak/[98c] [Coret] AUA - Dibatalkan dari Pendaftaran - Panjar Habis.rtf",
  "9 Penetapan Ahli Waris/[03] [Tolak] PAW - Dalil Tidak Terbukti.rtf",
  "9 Penetapan Ahli Waris/[98] [Cabut] PAW.rtf",
  "9 Penetapan Ahli Waris/[98a] [Gugur] PAW - Pemohon Tidak Pernah Hadir.rtf",
  "9 Penetapan Ahli Waris/[99a] [NO] PAW - Pemohon Tidak Hadir Lagi (SEMA 1 2022).rtf",
  "9 Penetapan Ahli Waris/[98c] [Coret] PAW - Dibatalkan dari Pendaftaran - Panjar Habis.rtf",
  "9a Lain-Lain (Pengangkatan Anak)/[03] [Tolak] Pengangkatan Anak - Dalil Tidak Terbukti.rtf",
  "9a Lain-Lain (Pengangkatan Anak)/[98] [Cabut] Pengangkatan Anak.rtf",
  "9a Lain-Lain (Pengangkatan Anak)/[98a] [Gugur] Pengangkatan Anak - Pemohon Tidak Pernah Hadir.rtf",
  "9a Lain-Lain (Pengangkatan Anak)/[99] [NO] Pengangkatan Anak - Pemohon Tidak Hadir Lagi (SEMA 1 2022).rtf",
  "9a Lain-Lain (Pengangkatan Anak)/[98c] [Coret] Pengangkatan Anak - Dibatalkan dari Pendaftaran - Panjar Habis.rtf",
  "2 Itsbat Nikah/[03a] [Tolak] IN - Rukun dan Syarat Nikah Tidak Terbukti.rtf",
  "2 Itsbat Nikah/[03b] [Tolak] IN - Terdapat Halangan Perkawinan.rtf",
];

const put = (m: Parameters<typeof rekomendasiBlangko>[0]) => {
  const r = rekomendasiBlangko({ urutanSidang: 5, sudahPutus: true, dihadiriOleh: 1, ...m }).putusan;
  return r.length ? { berkas: r[0].berkas.replace(/\.rtf$/, ""), folder: r[0].folder.replace(A, ""), semua: r.map((x) => x.berkas.replace(/\.rtf$/, "")) } : null;
};
const nama = (x: string) => x.replace(/\.rtf$/, "");

// ---------------------------------------------------------------------------
describe("A. pohon: 106 berkas paket ada di fixture dan dijangkau peta bawaan", () => {
  it("106 berkas baru paket (37 gugatan + 38 kumulasi + 31 permohonan) ada di fixture server", () => {
    expect(new Set(BARU_I17).size).toBe(106);
    const hilang = BARU_I17.filter((b) => !FIX.berkas.includes(`${A}${b}`));
    expect(hilang).toEqual([]);
  });

  it("tiap berkas yang dirujuk peta bawaan (utama atau varian) ADA di folder menunya", () => {
    const tanpa: string[] = [];
    for (const [kunci, b] of Object.entries(PETA_PUTUSAN_BAWAAN)) {
      const folder = b.blangko ? FOLDER_MENU_PUTUSAN[b.blangko] : undefined;
      if (!folder) continue;
      const semua = [b.berkas, ...(/^varian: /.test(b.catatan ?? "") ? (b.catatan ?? "").slice(8).split("; ").filter(Boolean) : [])];
      for (const n of semua) if (!FIX.berkas.includes(`${A}${folder}/${nama(n)}.rtf`)) tanpa.push(`${kunci} -> ${folder}/${n}`);
    }
    expect(tanpa).toEqual([]);
  });

  it("tiap dari 106 berkas paket DIJANGKAU: jadi pilihan utama suatu baris peta, atau varian yang disebut baris dasarnya", () => {
    const dijangkau = new Set<string>();
    for (const b of Object.values(PETA_PUTUSAN_BAWAAN)) {
      const folder = b.blangko ? FOLDER_MENU_PUTUSAN[b.blangko] : undefined;
      if (!folder) continue;
      dijangkau.add(`${folder}/${nama(b.berkas)}.rtf`);
      if (/^varian: /.test(b.catatan ?? "")) for (const v of (b.catatan ?? "").slice(8).split("; ").filter(Boolean)) dijangkau.add(`${folder}/${nama(v)}.rtf`);
    }
    expect(BARU_I17.filter((b) => !dijangkau.has(b))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("B. keadaan putusan baru", () => {
  const cg = { jenisPerkara: "Cerai Gugat", nomorPerkara: "5/Pdt.G/2026/PA.Dgl", dihadiriOleh: 1 };

  it("sesudah-jawaban: saklar tegas atau penandaJawaban bot; permohonan Pdt.P tidak; tanpa bahan tidak ditebak", () => {
    expect(keadaanPutusan({ ...cg, sesudahJawaban: true })[0]).toBe("sesudah-jawaban");
    expect(keadaanPutusan({ ...cg, penandaJawaban: { berkas: 2 } })[0]).toBe("sesudah-jawaban");
    expect(keadaanPutusan({ ...cg, penandaJawaban: { berkas: 0 } })).not.toContain("sesudah-jawaban");
    expect(keadaanPutusan({ ...cg, penandaJawaban: null })).not.toContain("sesudah-jawaban");
    expect(keadaanPutusan({ ...cg, sesudahJawaban: false, penandaJawaban: { berkas: 2 } })).not.toContain("sesudah-jawaban"); // saklar mati menang
    expect(keadaanPutusan({ jenisPerkara: "Perwalian", nomorPerkara: "5/Pdt.P/2026/PA.Dgl", dihadiriOleh: 1, sesudahJawaban: true })).toEqual([]);
    expect(keadaanPutusan({ jenisPerkara: "Lain-Lain", nomorPerkara: "7/Pdt.P/2024/PA.Dgl", dihadiriOleh: 1, sesudahJawaban: true })).toEqual([]); // pengangkatan anak
    expect(keadaanPutusan({ jenisPerkara: "Lain-Lain", nomorPerkara: "7/Pdt.G/2024/PA.Dgl", dihadiriOleh: 1, sesudahJawaban: true })).toEqual(["sesudah-jawaban", "kontradiktoir", "hak-asuh"]);
  });

  it("cacat-formil dan kurang-pihak hanya dari penanda tegas (SIPP tidak menyimpannya terstruktur)", () => {
    expect(keadaanPutusan(cg)).not.toContain("cacat-formil");
    expect(keadaanPutusan(cg)).not.toContain("kurang-pihak");
    expect(keadaanPutusan({ ...cg, cacatFormil: true })).toContain("cacat-formil");
    expect(keadaanPutusan({ ...cg, kurangPihak: true })[0]).toBe("kurang-pihak");
    expect(keadaanPutusan({ jenisPerkara: "Izin Poligami", dihadiriOleh: 1, cacatFormil: true })).not.toContain("cacat-formil"); // permohonan
  });

  it("alamat-t-tidak-diketahui dari ghaib/saklar; kumulasi-itsbat / kumulasi-hak-asuh hanya untuk cerai; itsbat-kabul-cerai-ditolak dari saklar atau amar", () => {
    expect(keadaanPutusan({ ...cg, penandaPerkara: { ghaib: true } })).toContain("alamat-t-tidak-diketahui");
    expect(keadaanPutusan({ ...cg, penandaPerkara: { ghaib: false } })).not.toContain("alamat-t-tidak-diketahui");
    expect(keadaanPutusan({ ...cg, alamatTergugatTidakDiketahui: true })).toContain("alamat-t-tidak-diketahui");
    const k = { daftar: [{ kode: "itsbat-nikah" }, { kode: "hak-asuh-anak" }] };
    expect(keadaanPutusan({ ...cg, kumulasi: k })).toEqual(["kontradiktoir", "kumulasi-itsbat", "kumulasi-hak-asuh"]);
    expect(keadaanPutusan({ jenisPerkara: "Harta Bersama", dihadiriOleh: 1, kumulasi: k })).toEqual(["kontradiktoir"]);
    expect(keadaanPutusan({ ...cg, kumulasi: ["itsbat-nikah"], itsbatKabulCeraiDitolak: true })[0]).toBe("itsbat-kabul-cerai-ditolak");
    expect(keadaanPutusan({ ...cg, itsbatKabulCeraiDitolak: true })).not.toContain("itsbat-kabul-cerai-ditolak"); // tanpa kumulasi itsbat
    const amar = "MENGADILI: 1. Mengabulkan permohonan itsbat nikah para Pemohon; 2. Menolak gugatan cerai Penggugat untuk selain dan selebihnya";
    expect(itsbatKabulCeraiDitolakDariAmar(amar)).toBe(true);
    expect(itsbatKabulCeraiDitolakDariAmar("Mengabulkan gugatan cerai; Mengabulkan itsbat nikah")).toBe(false);
    expect(itsbatKabulCeraiDitolakDariAmar("Menolak gugatan cerai")).toBe(false);
    expect(keadaanPutusan({ ...cg, kumulasi: ["itsbat-nikah"], amarPutusan: amar })[0]).toBe("itsbat-kabul-cerai-ditolak");
  });

  it("kontensius-verstek didahulukan atas kontensius; bukan verstek tetap kontensius saja; bawaan lama utuh", () => {
    const ink = { jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", nomorPerkara: "9/Pdt.G/2026/PA.Dgl" };
    expect(keadaanPutusan({ ...ink, verstekPutusan: true })).toEqual(["kontensius-verstek", "kontensius"]);
    expect(keadaanPutusan(ink)).toEqual(["kontensius"]);
    expect(keadaanPutusan({ ...ink, nomorPerkara: "9/Pdt.P/2026/PA.Dgl", verstekPutusan: true })).toEqual([]);
    expect(keadaanPutusan({ jenisPerkara: "Cerai Gugat", dihadiriOleh: 2, mediasi: { hasil: "T" }, mediasiTerbaca: true, panggilan: { tergugatPernahHadir: true } })).toEqual(["t-tidak-hadir-setelah-mediasi", "sesudah-mediasi"]);
  });
});

// ---------------------------------------------------------------------------
describe("C. pemilihan blangko gugatan", () => {
  const hb = { jenisPerkara: "Harta Bersama", nomorPerkara: "3/Pdt.G/2026/PA.Dgl" };
  const wr = { jenisPerkara: "Kewarisan", nomorPerkara: "4/Pdt.G/2026/PA.Dgl" };

  it("HB: kabul verstek [01b], tolak kontradiktoir [03] / verstek [03b], gugur [98a], coret [98c]; NO bawaan [99] dengan varian kurang pihak dan kabur; cabut sesudah jawaban [98b]", () => {
    const F = "4a Harta Bersama";
    expect(put({ ...hb, statusPutusan: "Dikabulkan", verstekPutusan: true, dihadiriOleh: 2 })).toMatchObject({ berkas: "[01b] [Kabul Verstek] HB", folder: F });
    expect(put({ ...hb, statusPutusan: "Ditolak" })).toMatchObject({ berkas: "[03] [Tolak] HB - Kontradiktoir - Objek Bukan Harta Bersama", folder: F });
    expect(put({ ...hb, statusPutusan: "Ditolak" })!.semua).toContain("[03b] [Tolak Verstek] HB - Objek Bukan Harta Bersama");
    expect(put({ ...hb, statusPutusan: "Ditolak", verstekPutusan: true, dihadiriOleh: 2 })).toMatchObject({ berkas: "[03b] [Tolak Verstek] HB - Objek Bukan Harta Bersama", folder: F });
    expect(put({ ...hb, statusPutusan: "Digugurkan" })!.berkas).toBe("[98a] [Gugur] HB - P Tidak Hadir Sidang Pertama");
    expect(put({ ...hb, statusPutusan: "Gugur" })!.berkas).toBe("[98a] [Gugur] HB - P Tidak Hadir Sidang Pertama");
    expect(put({ ...hb, statusPutusan: "Dicoret dari Register" })).toMatchObject({ berkas: "[98c] [Coret] HB - Dibatalkan dari Pendaftaran - Panjar Habis", folder: F });
    const no = put({ ...hb, statusPutusan: "Tidak Dapat Diterima" })!;
    expect(no.berkas).toBe("[99] [NO] HB - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022)");
    expect(no.semua).toEqual(expect.arrayContaining(["[99a] [NO] HB - Kurang Pihak (Plurium Litis Consortium)", "[99b] [NO] HB - Gugatan Kabur (Obscuur Libel)"]));
    expect(put({ ...hb, statusPutusan: "Tidak Dapat Diterima", kurangPihak: true })!.berkas).toBe("[99a] [NO] HB - Kurang Pihak (Plurium Litis Consortium)");
    expect(put({ ...hb, statusPutusan: "Tidak Dapat Diterima", cacatFormil: true })!.berkas).toBe("[99b] [NO] HB - Gugatan Kabur (Obscuur Libel)");
    // cabut: bawaan lama [98] utuh; sesudah jawaban (penanda bot) -> [98b]; [98b] disebut sebagai varian
    const cabut = put({ ...hb, statusPutusan: "Dicabut" })!;
    expect(cabut.berkas).toMatch(/^\[98\] \[Cabut\] Gugatan - P & T Hadir Sebelum Jawaban/);
    expect(put({ ...hb, statusPutusan: "Dicabut", penandaJawaban: { berkas: 1 } })!.berkas).toBe("[98b] [Cabut] HB - Sesudah Jawaban dengan Persetujuan T");
  });

  it("kewarisan: [01a] T tidak hadir sesudah mediasi, [01b] verstek, [03]/[03b], cabut [98] kini blangko 4b (bukan pinjaman HB), [98b], [98a], [98c], NO", () => {
    const F = "4b Kewarisan";
    expect(put({ ...wr, statusPutusan: "Dikabulkan", dihadiriOleh: 2, mediasi: { hasil: "T" }, mediasiTerbaca: true, tergugatPernahHadir: true })).toMatchObject({ berkas: "[01a] [Kabul] Kewarisan - T Tidak Hadir Setelah Mediasi", folder: F });
    expect(put({ ...wr, statusPutusan: "Dikabulkan", verstekPutusan: true, dihadiriOleh: 2 })).toMatchObject({ berkas: "[01b] [Kabul Verstek] Kewarisan", folder: F });
    expect(put({ ...wr, statusPutusan: "Ditolak" })).toMatchObject({ berkas: "[03] [Tolak] Kewarisan - Kontradiktoir - Dalil Tidak Terbukti", folder: F });
    expect(put({ ...wr, statusPutusan: "Ditolak", verstekPutusan: true, dihadiriOleh: 2 })!.berkas).toBe("[03b] [Tolak Verstek] Kewarisan - Dalil Tidak Terbukti");
    expect(put({ ...wr, statusPutusan: "Dicabut" })).toMatchObject({ berkas: "[98] [Cabut] Kewarisan - P & T Hadir Sebelum Jawaban", folder: F });
    expect(put({ ...wr, statusPutusan: "Dicabut", sesudahJawaban: true })!.berkas).toBe("[98b] [Cabut] Kewarisan - Sesudah Jawaban dengan Persetujuan T");
    expect(put({ ...wr, statusPutusan: "Digugurkan" })!.berkas).toBe("[98a] [Gugur] Kewarisan - P Tidak Hadir Sidang Pertama");
    expect(put({ ...wr, statusPutusan: "Dicoret dari Register" })!.berkas).toBe("[98c] [Coret] Kewarisan - Dibatalkan dari Pendaftaran - Panjar Habis");
    expect(put({ ...wr, statusPutusan: "Tidak Dapat Diterima", cacatFormil: true })!.berkas).toBe("[99b] [NO] Kewarisan - Gugatan Kabur (Obscuur Libel)");
  });

  it("hak asuh (Lain-Lain Pdt.G, 6a): cabut sesudah jawaban [98b], coret [98c], NO kurang pihak [99a] / kabur [99b]; pengangkatan anak Pdt.P tidak terpengaruh", () => {
    const ha = { jenisPerkara: "Lain-Lain", nomorPerkara: "358/Pdt.G/2020/PA.Dgl" };
    const F = "6a Hak Asuh Anak (Hadhanah)";
    expect(put({ ...ha, statusPutusan: "Dicabut", sesudahJawaban: true })).toMatchObject({ berkas: "[98b] [Cabut] Gugatan - Sesudah Jawaban dengan Persetujuan T", folder: F });
    expect(put({ ...ha, statusPutusan: "Dicabut" })!.berkas).toMatch(/^\[98\] \[Cabut\] Gugatan - P & T Hadir Sebelum Jawaban/);
    expect(put({ ...ha, statusPutusan: "Dicoret dari Register" })).toMatchObject({ berkas: "[98c] [Coret] Gugatan - Dibatalkan dari Pendaftaran - Panjar Habis", folder: F });
    expect(put({ ...ha, statusPutusan: "Tidak Dapat Diterima", kurangPihak: true })!.berkas).toBe("[99a] [NO] Gugatan - Kurang Pihak (Plurium Litis Consortium)");
    expect(put({ ...ha, statusPutusan: "Tidak Dapat Diterima", cacatFormil: true })!.berkas).toBe("[99b] [NO] Gugatan - Gugatan Kabur (Obscuur Libel)");
    expect(put({ ...ha, statusPutusan: "Tidak Dapat Diterima" })!.berkas).toBe("[99] [NO] Gugatan - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022)"); // bawaan lama utuh
    expect(put({ ...ha, statusPutusan: "Tidak Dapat Diterima" })!.semua).toEqual(expect.arrayContaining(["[99a] [NO] Gugatan - Kurang Pihak (Plurium Litis Consortium)", "[99b] [NO] Gugatan - Gugatan Kabur (Obscuur Libel)"]));
    const pa = { jenisPerkara: "Lain-Lain", nomorPerkara: "7/Pdt.P/2024/PA.Dgl" };
    expect(put({ ...pa, statusPutusan: "Dicabut", sesudahJawaban: true })).toMatchObject({ berkas: "[98] [Cabut] Pengangkatan Anak", folder: "9a Lain-Lain (Pengangkatan Anak)" });
  });

  it("pembatalan perkawinan: tolak verstek [03b], cabut sesudah jawaban [98b], coret [98c], NO [99a]/[99b]", () => {
    const pb = { jenisPerkara: "Pembatalan Perkawinan", nomorPerkara: "20/Pdt.G/2026/PA.Dgl" };
    const F = "5a Pembatalan Perkawinan";
    expect(put({ ...pb, statusPutusan: "Ditolak", verstekPutusan: true, dihadiriOleh: 2 })).toMatchObject({ berkas: "[03b] [Tolak Verstek] Pembatalan Perkawinan - Alasan Pembatalan Tidak Terbukti", folder: F });
    expect(put({ ...pb, statusPutusan: "Ditolak" })!.berkas).toMatch(/^\[03\] \[Tolak\]/); // bawaan lama utuh
    expect(put({ ...pb, statusPutusan: "Dicabut", sesudahJawaban: true })!.berkas).toBe("[98b] [Cabut] Pembatalan Perkawinan - Sesudah Jawaban dengan Persetujuan T");
    expect(put({ ...pb, statusPutusan: "Dicoret dari Register" })!.berkas).toBe("[98c] [Coret] Pembatalan Perkawinan - Dibatalkan dari Pendaftaran - Panjar Habis");
    expect(put({ ...pb, statusPutusan: "Tidak Dapat Diterima", kurangPihak: true })!.berkas).toBe("[99a] [NO] Pembatalan Perkawinan - Kurang Pihak (Plurium Litis Consortium)");
    expect(put({ ...pb, statusPutusan: "Tidak Dapat Diterima", cacatFormil: true })!.berkas).toBe("[99b] [NO] Pembatalan Perkawinan - Gugatan Kabur (Obscuur Libel)");
  });

  it("itsbat nikah kontensius (2a): kabul verstek [01b], tolak [03] / verstek [03b], gugur [98a], cabut sesudah jawaban [98b], coret [98c], NO [99a]/[99b]; itsbat voluntair tidak ikut", () => {
    const ink = { jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", nomorPerkara: "9/Pdt.G/2026/PA.Dgl" };
    const F = "2a Itsbat Nikah Kontensius";
    expect(put({ ...ink, statusPutusan: "Dikabulkan", verstekPutusan: true, dihadiriOleh: 2 })).toMatchObject({ berkas: "[01b] [Kabul Verstek] IN Kontensius - Pasangan Meninggal, Ahli Waris Tidak Hadir", folder: F });
    expect(put({ ...ink, statusPutusan: "Dikabulkan" })!.berkas).toBe("[01] [Kabul] IN Kontensius - Pasangan Meninggal, Ahli Waris Mengakui");
    expect(put({ ...ink, statusPutusan: "Ditolak" })).toMatchObject({ berkas: "[03] [Tolak] IN Kontensius - Kontradiktoir - Rukun dan Syarat Tidak Terbukti", folder: F });
    expect(put({ ...ink, statusPutusan: "Ditolak", verstekPutusan: true, dihadiriOleh: 2 })!.berkas).toBe("[03b] [Tolak Verstek] IN Kontensius - Rukun dan Syarat Tidak Terbukti");
    expect(put({ ...ink, statusPutusan: "Digugurkan" })!.berkas).toBe("[98a] [Gugur] IN Kontensius - P Tidak Hadir Sidang Pertama");
    expect(put({ ...ink, statusPutusan: "Dicabut", sesudahJawaban: true })!.berkas).toBe("[98b] [Cabut] IN Kontensius - Sesudah Jawaban dengan Persetujuan T");
    expect(put({ ...ink, statusPutusan: "Dicabut" })!.berkas).toBe("[98] [Cabut] Gugatan - P & T Hadir Sebelum Jawaban");
    expect(put({ ...ink, statusPutusan: "Dicoret dari Register" })!.berkas).toBe("[98c] [Coret] IN Kontensius - Dibatalkan dari Pendaftaran - Panjar Habis");
    expect(put({ ...ink, statusPutusan: "Tidak Dapat Diterima", kurangPihak: true })!.berkas).toBe("[99a] [NO] IN Kontensius - Kurang Pihak (Ahli Waris Lain Tidak Ditarik)");
    expect(put({ ...ink, statusPutusan: "Tidak Dapat Diterima", cacatFormil: true })!.berkas).toBe("[99b] [NO] IN Kontensius - Gugatan Kabur (Obscuur Libel)");
    // itsbat voluntair (Pdt.P): tolak tetap [03], varian [03a]/[03b]; coret [98c]; NO SEMA [99a]
    const vol = { jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", nomorPerkara: "9/Pdt.P/2026/PA.Dgl" };
    const tolak = put({ ...vol, statusPutusan: "Ditolak" })!;
    expect(tolak).toMatchObject({ berkas: "[03] [Tolak] IN - Rukun Tidak Terpenuhi (Wali Tidak Sah)", folder: "2 Itsbat Nikah" });
    expect(tolak.semua).toEqual(expect.arrayContaining(["[03a] [Tolak] IN - Rukun dan Syarat Nikah Tidak Terbukti", "[03b] [Tolak] IN - Terdapat Halangan Perkawinan"]));
    expect(put({ ...vol, statusPutusan: "Dicoret dari Register" })).toMatchObject({ berkas: "[98c] [Coret] IN - Dibatalkan dari Pendaftaran - Panjar Habis", folder: "2 Itsbat Nikah" });
  });

  it("cerai gugat dan talak (folder 1 / 1a): cabut sesudah jawaban [98] 7., NO cacat formil [98] 8.; bawaan lama utuh", () => {
    for (const [jenis, folder] of [["Cerai Gugat", "1 Perceraian CG"], ["Cerai Talak", "1a Perceraian CT"]] as const) {
      const c = { jenisPerkara: jenis, nomorPerkara: "5/Pdt.G/2026/PA.Dgl" };
      expect(put({ ...c, statusPutusan: "Dicabut", sesudahJawaban: true })).toMatchObject({ berkas: "[98] [Cabut] 7. Cerai P & T Hadir - Sesudah Jawaban dengan Persetujuan T", folder });
      expect(put({ ...c, statusPutusan: "Tidak Dapat Diterima", cacatFormil: true })).toMatchObject({ berkas: "[98] [NO] 8. Cerai P & T Hadir - Kontradiktoir - Cacat Formil " + (jenis === "Cerai Gugat" ? "Gugatan" : "Permohonan"), folder });
      expect(put({ ...c, statusPutusan: "Dicabut" })!.berkas).toMatch(/^\[98\] \[Cabut\] 1a\./);
      expect(put({ ...c, statusPutusan: "Tidak Dapat Diterima" })!.berkas).toMatch(/^\[98\] \[NO\] 4\./);
      // cabut sesudah mediasi (bawaan lama) menang atas sesudah-jawaban TIDAK: sesudah-jawaban lebih khusus dan didahulukan
      expect(put({ ...c, statusPutusan: "Dicabut", mediasi: { hasil: "T" }, mediasiTerbaca: true })!.berkas).toMatch(/^\[98\] \[Cabut\] 2\./);
    }
  });
});

// ---------------------------------------------------------------------------
describe("D. cerai kumulasi itsbat (1c) dan kumulasi hak asuh (1d)", () => {
  const kum = (...kode: string[]) => ({ daftar: kode.map((k) => ({ kode: k })) });
  const cg = { jenisPerkara: "Cerai Gugat", nomorPerkara: "5/Pdt.G/2026/PA.Dgl" };
  const ct = { jenisPerkara: "Cerai Talak", nomorPerkara: "6/Pdt.G/2026/PA.Dgl" };
  const IN1C = "1c Perceraian Kumulasi Itsbat Nikah";
  const HA1D = "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak";

  it("kumulasi itsbat: kabul kontradiktoir [02], T tidak hadir sesudah mediasi [01c] (CG dan CT berbeda berkas, folder sama); kabul verstek tetap [01aa]", () => {
    expect(put({ ...cg, statusPutusan: "Dikabulkan", kumulasi: kum("itsbat-nikah") })).toMatchObject({ berkas: "[02] [Kabul] Putusan CG Kumulasi Itsbat Nikah - Kontradiktoir", folder: IN1C });
    expect(put({ ...ct, statusPutusan: "Dikabulkan", kumulasi: kum("itsbat-nikah") })).toMatchObject({ berkas: "[02] [Kabul] Putusan CT Kumulasi Itsbat Nikah - Kontradiktoir", folder: IN1C });
    const sm = { statusPutusan: "Dikabulkan", dihadiriOleh: 2, mediasi: { hasil: "T" }, mediasiTerbaca: true, tergugatPernahHadir: true, kumulasi: kum("itsbat-nikah") };
    expect(put({ ...cg, ...sm })).toMatchObject({ berkas: "[01c] [Kabul] Putusan CG Kumulasi Itsbat Nikah - T Tidak Hadir Setelah Mediasi", folder: IN1C });
    expect(put({ ...ct, ...sm })).toMatchObject({ berkas: "[01c] [Kabul] Putusan CT Kumulasi Itsbat Nikah - T Tidak Hadir Setelah Mediasi", folder: IN1C });
    expect(put({ ...cg, statusPutusan: "Dikabulkan", verstekPutusan: true, dihadiriOleh: 2, kumulasi: kum("itsbat-nikah") })!.berkas).toMatch(/^\[01aa\] \[Kabul Verstek\] Putusan CG Kumulasi Itsbat Nikah/);
    // tanpa kumulasi: cerai biasa utuh
    expect(put({ ...cg, statusPutusan: "Dikabulkan" })).toMatchObject({ folder: "1 Perceraian CG" });
  });

  it("kumulasi itsbat: tolak (itsbat kabul, cerai ditolak) [03] hanya bila ditandai; selainnya cerai biasa; cabut/gugur/coret/NO", () => {
    const tolak = { statusPutusan: "Ditolak", kumulasi: kum("itsbat-nikah") };
    expect(put({ ...cg, ...tolak })!.folder).toBe("1 Perceraian CG"); // tidak ditebak
    expect(put({ ...cg, ...tolak, itsbatKabulCeraiDitolak: true })).toMatchObject({ berkas: "[03] [Tolak] Putusan CG Kumulasi Itsbat Nikah - Itsbat Kabul, Cerai Ditolak (Kontradiktoir)", folder: IN1C });
    expect(put({ ...ct, ...tolak, itsbatKabulCeraiDitolak: true })!.berkas).toBe("[03] [Tolak] Putusan CT Kumulasi Itsbat Nikah - Itsbat Kabul, Cerai Ditolak (Kontradiktoir)");
    expect(put({ ...cg, statusPutusan: "Ditolak", kumulasi: kum("itsbat-nikah"), amarPutusan: "Mengabulkan permohonan itsbat nikah; Menolak gugatan cerai" })!.folder).toBe(IN1C);
    const k = { kumulasi: kum("itsbat-nikah") };
    expect(put({ ...cg, ...k, statusPutusan: "Dicabut" })).toMatchObject({ berkas: "[98] [Cabut] Putusan CG Kumulasi Itsbat Nikah - P & T Hadir Sebelum Jawaban", folder: IN1C });
    expect(put({ ...cg, ...k, statusPutusan: "Dicabut", sesudahJawaban: true })!.berkas).toBe("[98b] [Cabut] Putusan CG Kumulasi Itsbat Nikah - Sesudah Jawaban dengan Persetujuan T");
    expect(put({ ...cg, ...k, statusPutusan: "Digugurkan" })!.berkas).toBe("[98a] [Gugur] Putusan CG Kumulasi Itsbat Nikah - P & T Tidak Hadir");
    expect(put({ ...cg, ...k, statusPutusan: "Gugur", dihadiriOleh: 3, hadirSebelumnya: 3 })!.berkas).toBe("[98d] [Gugur] Putusan CG Kumulasi Itsbat Nikah - P Tidak Hadir T Hadir");
    expect(put({ ...cg, ...k, statusPutusan: "Dicoret dari Register" })!.berkas).toBe("[98c] [Coret] Putusan CG Kumulasi Itsbat Nikah - Dibatalkan dari Pendaftaran - Panjar Habis");
    expect(put({ ...ct, ...k, statusPutusan: "Tidak Dapat Diterima", cacatFormil: true })!.berkas).toBe("[99b] [NO] Putusan CT Kumulasi Itsbat Nikah - Kontradiktoir - Cacat Formil Gugatan");
    expect(put({ ...cg, ...k, statusPutusan: "Tidak Dapat Diterima", penandaPerkara: { ghaib: true } })!.berkas).toBe("[99c] [NO] Putusan CG Kumulasi Itsbat Nikah - Alamat T Tidak Diketahui");
  });

  it("kumulasi hak asuh: kabul [02] / [01c]; hak asuh + nafkah [02b] / [01d]; cabut, gugur, NO; CT tidak punya kumulasi hak asuh", () => {
    const ha = { kumulasi: kum("hak-asuh-anak") };
    expect(put({ ...cg, ...ha, statusPutusan: "Dikabulkan" })).toMatchObject({ berkas: "[02] [Kabul] Putusan CG Kumulasi Hak Asuh Anak - Kontradiktoir", folder: HA1D });
    expect(put({ ...cg, ...ha, statusPutusan: "Dikabulkan", dihadiriOleh: 2, mediasi: { hasil: "T" }, mediasiTerbaca: true, tergugatPernahHadir: true })!.berkas).toBe("[01c] [Kabul] Putusan CG Kumulasi Hak Asuh Anak - T Tidak Hadir Setelah Mediasi");
    const nf = { kumulasi: kum("hak-asuh-anak", "nafkah-anak") };
    expect(put({ ...cg, ...nf, statusPutusan: "Dikabulkan" })!.berkas).toBe("[02b] [Kabul] Putusan CG Kumulasi Hak Asuh dan Nafkah Anak - Kontradiktoir");
    expect(put({ ...cg, ...nf, statusPutusan: "Dikabulkan", dihadiriOleh: 2, mediasi: { hasil: "T" }, mediasiTerbaca: true, tergugatPernahHadir: true })!.berkas).toBe("[01d] [Kabul] Putusan CG Kumulasi Hak Asuh dan Nafkah Anak - T Tidak Hadir Setelah Mediasi");
    expect(put({ ...cg, ...nf, statusPutusan: "Dicabut" })!.berkas).toBe("[98] [Cabut] Putusan CG Kumulasi Hak Asuh Anak - P & T Hadir Sebelum Jawaban");
    expect(put({ ...cg, ...ha, statusPutusan: "Tidak Dapat Diterima", dihadiriOleh: 4, hadirSebelumnya: 4, penggugatPernahHadir: true })!.berkas).toBe("[99] [NO] Putusan CG Kumulasi Hak Asuh Anak - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022)");
    expect(put({ ...cg, ...ha, statusPutusan: "Digugurkan" })!.folder).toBe(HA1D);
    expect(put({ ...ct, ...ha, statusPutusan: "Dikabulkan" })!.folder).toBe("1a Perceraian CT");
  });

  it("kumulasi + hak asuh: kabul verstek tetap berkas lama", () => {
    expect(put({ ...cg, kumulasi: kum("hak-asuh-anak"), statusPutusan: "Dikabulkan", verstekPutusan: true, dihadiriOleh: 2 })!.berkas).toMatch(/^\[01\] \[Kabul Verstek\] Putusan CG Kumulasi Hak Asuh Anak/);
  });
});

// ---------------------------------------------------------------------------
describe("E. permohonan (folder 2, 3, 5, 6, 7, 8, 9, 9a): gugur, coret, NO SEMA, tolak, cabut kini blangko jenisnya sendiri", () => {
  const sema = { dihadiriOleh: 4, hadirSebelumnya: 4, penggugatPernahHadir: true };
  const kasus: Array<[string, string, string, string, Record<string, unknown>, string]> = [
    // [jenis, status, folder, berkas, tambahan, nomor]
    ["Dispensasi Kawin", "Digugurkan", "3 Dispensasi Kawin", "[98a] [Gugur] DK - Pemohon Tidak Pernah Hadir", {}, "1/Pdt.P/2026/PA.Dgl"],
    ["Dispensasi Kawin", "Gugur", "3 Dispensasi Kawin", "[98a] [Gugur] DK - Pemohon Tidak Pernah Hadir", {}, "1/Pdt.P/2026/PA.Dgl"],
    ["Dispensasi Kawin", "Dicoret dari Register", "3 Dispensasi Kawin", "[98c] [Coret] DK - Dibatalkan dari Pendaftaran - Panjar Habis", {}, "1/Pdt.P/2026/PA.Dgl"],
    ["Izin Poligami", "Ditolak", "5 Izin Poligami", "[03] [Tolak] Izin Poligami - Syarat Tidak Terbukti", {}, "1/Pdt.G/2026/PA.Dgl"],
    ["Izin Poligami", "Digugurkan", "5 Izin Poligami", "[98a] [Gugur] Izin Poligami - Pemohon Tidak Pernah Hadir", {}, "1/Pdt.G/2026/PA.Dgl"],
    ["Izin Poligami", "Tidak Dapat Diterima", "5 Izin Poligami", "[99] [NO] Izin Poligami - Pemohon Tidak Hadir Lagi (SEMA 1 2022)", sema, "1/Pdt.G/2026/PA.Dgl"],
    ["Izin Poligami", "Dicoret dari Register", "5 Izin Poligami", "[98c] [Coret] Izin Poligami - Dibatalkan dari Pendaftaran - Panjar Habis", {}, "1/Pdt.G/2026/PA.Dgl"],
    ["Perwalian", "Dicabut", "6 Perwalian", "[98] [Cabut] Perwalian", {}, "1/Pdt.P/2026/PA.Dgl"],
    ["Perwalian", "Digugurkan", "6 Perwalian", "[98a] [Gugur] Perwalian - Pemohon Tidak Pernah Hadir", {}, "1/Pdt.P/2026/PA.Dgl"],
    ["Perwalian", "Tidak Dapat Diterima", "6 Perwalian", "[99] [NO] Perwalian - Pemohon Tidak Hadir Lagi (SEMA 1 2022)", sema, "1/Pdt.P/2026/PA.Dgl"],
    ["Perwalian", "Dicoret dari Register", "6 Perwalian", "[98c] [Coret] Perwalian - Dibatalkan dari Pendaftaran - Panjar Habis", {}, "1/Pdt.P/2026/PA.Dgl"],
    ["Wali Adhal", "Digugurkan", "7 Wali Adhal", "[98a] [Gugur] Wali Adhal - Pemohon Tidak Pernah Hadir", {}, "1/Pdt.P/2026/PA.Dgl"],
    ["Wali Adhal", "Tidak Dapat Diterima", "7 Wali Adhal", "[99] [NO] Wali Adhal - Pemohon Tidak Hadir Lagi (SEMA 1 2022)", sema, "1/Pdt.P/2026/PA.Dgl"],
    ["Wali Adhal", "Dicoret dari Register", "7 Wali Adhal", "[98c] [Coret] Wali Adhal - Dibatalkan dari Pendaftaran - Panjar Habis", {}, "1/Pdt.P/2026/PA.Dgl"],
    ["Asal Usul Anak", "Ditolak", "8 Asal Usul Anak", "[03] [Tolak] AUA - Dalil Tidak Terbukti", {}, "1/Pdt.P/2026/PA.Dgl"],
    ["Asal Usul Anak", "Digugurkan", "8 Asal Usul Anak", "[98a] [Gugur] AUA - Pemohon Tidak Pernah Hadir", {}, "1/Pdt.P/2026/PA.Dgl"],
    ["Asal Usul Anak", "Tidak Dapat Diterima", "8 Asal Usul Anak", "[99a] [NO] AUA - Pemohon Tidak Hadir Lagi (SEMA 1 2022)", sema, "1/Pdt.P/2026/PA.Dgl"],
    ["Asal Usul Anak", "Dicoret dari Register", "8 Asal Usul Anak", "[98c] [Coret] AUA - Dibatalkan dari Pendaftaran - Panjar Habis", {}, "1/Pdt.P/2026/PA.Dgl"],
    ["Penetapan Ahli Waris", "Ditolak", "9 Penetapan Ahli Waris", "[03] [Tolak] PAW - Dalil Tidak Terbukti", {}, "1/Pdt.P/2026/PA.Dgl"],
    ["Penetapan Ahli Waris", "Dicabut", "9 Penetapan Ahli Waris", "[98] [Cabut] PAW", {}, "1/Pdt.P/2026/PA.Dgl"],
    ["Penetapan Ahli Waris", "Digugurkan", "9 Penetapan Ahli Waris", "[98a] [Gugur] PAW - Pemohon Tidak Pernah Hadir", {}, "1/Pdt.P/2026/PA.Dgl"],
    ["Penetapan Ahli Waris", "Tidak Dapat Diterima", "9 Penetapan Ahli Waris", "[99a] [NO] PAW - Pemohon Tidak Hadir Lagi (SEMA 1 2022)", sema, "1/Pdt.P/2026/PA.Dgl"],
    ["Penetapan Ahli Waris", "Dicoret dari Register", "9 Penetapan Ahli Waris", "[98c] [Coret] PAW - Dibatalkan dari Pendaftaran - Panjar Habis", {}, "1/Pdt.P/2026/PA.Dgl"],
    ["Lain-Lain", "Ditolak", "9a Lain-Lain (Pengangkatan Anak)", "[03] [Tolak] Pengangkatan Anak - Dalil Tidak Terbukti", {}, "1/Pdt.P/2026/PA.Dgl"],
    ["Lain-Lain", "Dicabut", "9a Lain-Lain (Pengangkatan Anak)", "[98] [Cabut] Pengangkatan Anak", {}, "1/Pdt.P/2026/PA.Dgl"],
    ["Lain-Lain", "Digugurkan", "9a Lain-Lain (Pengangkatan Anak)", "[98a] [Gugur] Pengangkatan Anak - Pemohon Tidak Pernah Hadir", {}, "1/Pdt.P/2026/PA.Dgl"],
    ["Lain-Lain", "Tidak Dapat Diterima", "9a Lain-Lain (Pengangkatan Anak)", "[99] [NO] Pengangkatan Anak - Pemohon Tidak Hadir Lagi (SEMA 1 2022)", sema, "1/Pdt.P/2026/PA.Dgl"],
    ["Lain-Lain", "Dicoret dari Register", "9a Lain-Lain (Pengangkatan Anak)", "[98c] [Coret] Pengangkatan Anak - Dibatalkan dari Pendaftaran - Panjar Habis", {}, "1/Pdt.P/2026/PA.Dgl"],
    ["Pengesahan Perkawinan/Istbat Nikah", "Tidak Dapat Diterima", "2 Itsbat Nikah", "[99a] [NO] IN - Pemohon Tidak Hadir Lagi (SEMA 1 2022)", sema, "1/Pdt.P/2026/PA.Dgl"],
  ];
  for (const [jenis, status, folder, berkas, tambahan, nomor] of kasus) {
    it(`${jenis} · ${status} -> ${folder}/${berkas.slice(0, 40)}`, () => {
      const h = put({ jenisPerkara: jenis, nomorPerkara: nomor, statusPutusan: status, ...tambahan } as Parameters<typeof rekomendasiBlangko>[0])!;
      expect(h, `${jenis} ${status}`).toMatchObject({ berkas, folder });
      expect(FIX.berkas).toContain(`${A}${folder}/${berkas}.rtf`);
    });
  }

  it("bawaan permohonan lain tidak berubah: perwalian ditolak, wali adhal ditolak, PAW kabul", () => {
    expect(put({ jenisPerkara: "Perwalian", nomorPerkara: "1/Pdt.P/2026/PA.Dgl", statusPutusan: "Ditolak" })!.folder).toBe("6 Perwalian");
    expect(put({ jenisPerkara: "Wali Adhal", nomorPerkara: "1/Pdt.P/2026/PA.Dgl", statusPutusan: "Ditolak" })!.berkas).toMatch(/^\[03\] \[Tolak\] Wali Adhal/);
    expect(put({ jenisPerkara: "Penetapan Ahli Waris", nomorPerkara: "1/Pdt.P/2026/PA.Dgl", statusPutusan: "Dikabulkan" })!.berkas).toMatch(/^\[01\] \[Kabul\] PAW/);
  });
});

// ---------------------------------------------------------------------------
describe("F. bahan keadaan dari baris jadwal bot; TS = panel-alat.js (alatPetaUntukPerkara) untuk baris kumulasi berkeadaan", () => {
  it("masukanRekomendasiDariBaris membawa penandaJawaban, penandaPerkara dan saklar; sidang pembacaan putusan memilih cabut sesudah jawaban", () => {
    const baris = { jenisPerkara: "Harta Bersama", nomorPerkara: "3/Pdt.G/2026/PA.Dgl", sudahPutus: true, statusPutusan: "Dicabut", dihadiriOleh: 1, penandaJawaban: { berkas: 1, dibaca: 1 }, penandaPerkara: { ghaib: false }, kurangPihak: true };
    const m = masukanRekomendasiDariBaris(baris);
    expect(m).toMatchObject({ penandaJawaban: { berkas: 1 }, penandaPerkara: { ghaib: false }, kurangPihak: true });
    expect(rekomendasiBlangko({ ...m, urutanSidang: 5 }).putusan[0].berkas).toBe("[98b] [Cabut] HB - Sesudah Jawaban dengan Persetujuan T.rtf");
    expect(masukanRekomendasiDariBaris({ jenisPerkara: "Harta Bersama" })).toMatchObject({ penandaJawaban: null, penandaPerkara: null });
  });

  it("pilihPutusanBawaan (TS) sama dengan alatPetaUntukPerkara (JS) untuk kunci kumulasi berkeadaan", () => {
    const sumber = readFileSync(path.resolve(__dirname, "../../../ekstensi-sipp/panel-alat.js"), "utf8");
    const elemen = () => ({ style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} }, dataset: {}, setAttribute() {}, removeAttribute() {}, getAttribute: () => null, appendChild: (x: unknown) => x, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} });
    const konteks: Record<string, unknown> = {
      console, setTimeout, clearTimeout, Date, JSON, Math, Number, String, Boolean, Array, Object, Promise, Error, Map, Set, URLSearchParams, URL, AbortController,
      document: { documentElement: elemen(), createElement: elemen, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
      location: { origin: "http://127.0.0.1", pathname: "/", search: "" },
      window: { location: { hostname: "127.0.0.1", pathname: "/", search: "", origin: "http://127.0.0.1" }, sessionStorage: { getItem: () => null, setItem() {} }, localStorage: { getItem: () => null, setItem() {} }, addEventListener() {}, postMessage() {} },
      chrome: { runtime: { getManifest: () => ({ version: "0.0.0" }), getURL: (p: string) => p }, storage: { onChanged: { addListener() {} }, local: { get: async () => ({}), set: async () => undefined, remove: async () => undefined } } },
      fetch: async () => ({ ok: true, status: 200, json: async () => ({}), clone() { return this; } }),
      requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
    };
    konteks.globalThis = konteks;
    vm.createContext(konteks);
    vm.runInContext(sumber, konteks, { filename: "panel-alat.js" });
    const jalan = (kode: string) => JSON.parse(JSON.stringify(vm.runInContext(kode, konteks) ?? null));
    const kasus: Array<[string, string, boolean, string[], string[]]> = [
      ["Cerai Gugat", "Dikabulkan", false, ["itsbat-nikah"], ["kontradiktoir", "kumulasi-itsbat"]],
      ["Cerai Gugat", "Dikabulkan", false, ["itsbat-nikah"], ["t-tidak-hadir-setelah-mediasi", "sesudah-mediasi", "kumulasi-itsbat"]],
      ["Cerai Talak", "Dicabut", false, ["itsbat-nikah"], ["sesudah-jawaban", "kumulasi-itsbat"]],
      ["Cerai Gugat", "Ditolak", false, ["itsbat-nikah"], ["itsbat-kabul-cerai-ditolak", "kontradiktoir", "kumulasi-itsbat"]],
      ["Cerai Gugat", "Tidak Dapat Diterima", false, ["hak-asuh-anak"], ["alamat-t-tidak-diketahui", "kumulasi-hak-asuh"]],
      ["Cerai Gugat", "Dikabulkan", false, ["hak-asuh-anak", "nafkah-anak"], ["kontradiktoir"]],
      ["Cerai Gugat", "Dikabulkan", true, ["itsbat-nikah"], ["verstek-tanpa-bendera"]],
      ["Cerai Gugat", "Digugurkan", false, ["hak-asuh-anak"], ["p-tidak-hadir-t-hadir"]],
      ["Harta Bersama", "Dicabut", false, [], ["sesudah-jawaban"]],
      ["Pengesahan Perkawinan/Istbat Nikah", "Dikabulkan", true, [], ["kontensius-verstek", "kontensius"]],
    ];
    for (const [j, s, v, k, kd] of kasus) {
      const kum = k.length ? { daftar: k.map((x) => ({ kode: x })) } : null;
      const dariAlat = jalan(`alatPetaUntukPerkara(ALAT_PETA_BAWAAN, ${JSON.stringify(j)}, ${JSON.stringify(s)}, ${v}, ${JSON.stringify(kum)}, ${JSON.stringify(kd)})`) as { kunci: string; tingkat: string } | null;
      const dariTs = pilihPutusanBawaan(PETA_PUTUSAN_BAWAAN, j, s, v, kum, kd);
      expect(dariTs ? { kunci: dariTs.kunci, tingkat: dariTs.tingkat } : null, `${j} ${s} ${k} ${kd}`).toEqual(dariAlat ? { kunci: dariAlat.kunci, tingkat: dariAlat.tingkat } : null);
    }
    // dan salah satunya benar-benar memakai tingkat baru
    expect(pilihPutusanBawaan(PETA_PUTUSAN_BAWAAN, "Cerai Gugat", "Dikabulkan", false, { daftar: [{ kode: "itsbat-nikah" }] }, ["kontradiktoir"])).toMatchObject({ tingkat: "kumulasi-keadaan", kunci: "cerai gugat+itsbat-nikah|dikabulkan|kontradiktoir" });
  });
});
