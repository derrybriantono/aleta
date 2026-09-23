// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * EMPAT PERMINTAAN 23 SEPTEMBER 2026
 * ============================================================================
 *
 *    9. urutan bawaan daftar sidang mengikuti nomor antrian
 *   11. nomor urut sidang di kiri daftar berkas SIPP dan e-Court
 *   12. tombol ciutkan panel ABT/portal yang "tidak bekerja"
 *   13. chip kepala ABT menyebut JENIS perkara, bukan alurnya
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(akar, jalur), "utf8").replace(/\r\n/g, "\n");

const layar = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
const alat = baca("ekstensi-sipp/panel-alat.js");
const abt = baca("ekstensi-sipp/abt.js");

// ===========================================================================
// BUTIR 9
// ===========================================================================

describe("butir 9 - urutan bawaan mengikuti nomor antrian", () => {
  const blok = () => {
    const i = layar.indexOf("URUTAN BAWAAN: NOMOR ANTRIAN, DARI YANG PERTAMA");
    expect(i, "blok urutan bawaan tidak ditemukan").toBeGreaterThan(-1);
    return layar.slice(i, layar.indexOf("return urutkan(hasil, urutTabel", i));
  };

  it("hanya berlaku ketika TIDAK ada kepala kolom yang ditekan", () => {
    // Pilihan orang menang atas bawaan. Tanpa pagar ini, menekan kepala kolom
    // tidak mengubah apa pun - dan tabel yang tidak menanggapi tekanan
    // terbaca sebagai tabel yang rusak.
    expect(blok()).toContain("if (!urutTabel) {");
  });

  it("yang BELUM bernomor jatuh ke bawah, bukan ke puncak", () => {
    // Nol akan melemparkan seluruh perkara yang belum mengambil antrian ke
    // baris teratas - kebalikan dari yang diminta.
    const b = blok();
    expect(b).toContain("Number.MAX_SAFE_INTEGER");
    expect(b, "nilai nol akan melemparkannya ke puncak").not.toMatch(/return\s+.*\?\s*n\s*:\s*0;/);
  });

  it("urutan asal dipertahankan bagi yang sama - sort stabil", () => {
    // "selanjutnya mengikuti sesuai sekarang" - yang belum bernomor tidak
    // boleh diacak ulang di antara mereka sendiri.
    expect(blok()).toContain("[...hasil].sort(");
  });
});

// ===========================================================================
// BUTIR 11
// ===========================================================================

describe("butir 11 - nomor sidang di kiri daftar berkas", () => {
  it("relaas menyebut sidang keberapa, dari sidangId-nya", () => {
    // Satu sidang dapat punya beberapa relaas, jadi nomornya TIDAK boleh
    // diturunkan dari urutan barisnya sendiri.
    const i = layar.indexOf("{sipp.relaas.map((baris) => (");
    expect(i).toBeGreaterThan(-1);
    const blok = layar.slice(i, i + 900);
    expect(blok).toContain("<NomorSidang urutan={urutanSidangPer.get(String(baris.sidangId");
  });

  it("berita acara sidang menyebutnya dari urutanSidang barisnya", () => {
    const i = layar.indexOf("{sipp.jadwalPerkara.map((sidang) => (");
    expect(i).toBeGreaterThan(-1);
    const blok = layar.slice(i, i + 700);
    expect(blok).toContain("<NomorSidang urutan={sidang.urutanSidang} />");
  });

  it("dokumen e-Court punya kolomnya sendiri, dipetakan lewat tanggal", () => {
    expect(layar).toContain("const urutanSidangPerTanggal = useMemo(");
    expect(layar).toContain('title="Sidang keberapa"');
  });

  it("hari yang memuat LEBIH DARI SATU sidang tidak dipetakan", () => {
    // Menebak salah satunya berarti menempelkan nomor yang keliru pada berkas
    // perkara - dan nomor yang keliru di sana lebih buruk daripada kosong.
    const i = layar.indexOf("const urutanSidangPerTanggal = useMemo(");
    const blok = layar.slice(i, layar.indexOf("}, [rincian?.sipp?.jadwalPerkara]);", i));
    expect(blok).toContain("if (daftar.length === 1)");
  });

  it("tanggalnya dipotong ke HARI - dua bentuk yang sama tidak jadi dua kunci", () => {
    const i = layar.indexOf("const urutanSidangPerTanggal = useMemo(");
    const blok = layar.slice(i, layar.indexOf("}, [rincian?.sipp?.jadwalPerkara]);", i));
    expect(blok).toContain(".slice(0, 10)");
  });
});

// ===========================================================================
// BUTIR 12
// ===========================================================================

describe("butir 12 - tombol ciutkan yang membatalkan dirinya sendiri", () => {
  /**
   * Tombolnya BEKERJA - panel benar-benar menciut. Lalu klik yang SAMA
   * menggelembung ke panel, pendengar bentangkan berjalan, pagarnya justru
   * TERBUKA karena kelas lencana baru saja dipasang tiga langkah sebelumnya,
   * dan panel terbentang kembali sebelum satu bingkai pun digambar.
   *
   * Hasil bersihnya nol, tanpa satu galat pun - persis "ditekan, tidak terjadi
   * apa-apa". Buktinya: tombolnya BERHASIL tepat sesudah panel digeser, sebab
   * penanda baruDigeser menghentikan langkah itu.
   */
  const blokBentangkan = () => {
    const i = alat.indexOf("const bentangkan = (peristiwa) => {");
    expect(i, "pendengar bentangkan tidak ditemukan").toBeGreaterThan(-1);
    return alat.slice(i, alat.indexOf("alatCiutkan(panel, kunci, false);", i));
  };

  it("klik yang berasal dari sebuah tombol tidak membentangkan", () => {
    const b = blokBentangkan();
    expect(b).toContain('closest("button, a, input, select, textarea, label")');
  });

  it("pagar tombol diperiksa SEBELUM pagar kelas lencana", () => {
    // Urutannya menentukan. Pagar kelas lencana justru terbuka pada peristiwa
    // itu, jadi menaruh pagar tombol sesudahnya tidak menolong apa pun.
    const b = blokBentangkan();
    expect(b.indexOf("closest(")).toBeLessThan(b.indexOf("classList.contains(KELAS_LENCANA)"));
  });

  it("pendengarnya TETAP pada panel, bukan dipindah ke lencananya", () => {
    // Memindahkannya akan mengulang cacat yang justru diperbaiki catatan
    // panjang di sebelahnya: tangkapan penunjuk membelokkan klik ke panel,
    // sehingga pendengar pada anak tidak pernah berjalan.
    expect(alat).toContain('panel.addEventListener("click", bentangkan)');
  });

  it("sebabnya TERTULIS beserta urutan peristiwanya", () => {
    expect(alat).toContain("KLIK DARI SEBUAH TOMBOL BUKAN KLIK PADA LENCANA");
    expect(alat).toContain("baruDigeser");
  });
});

// ===========================================================================
// BUTIR 13
// ===========================================================================

describe("butir 13 - chip kepala ABT menyebut jenis perkara", () => {
  it("membaca variabel 0048 lebih dulu", () => {
    expect(abt).toContain('const VAR_JENIS_PERKARA = "0048"');
    expect(abt).toContain("nilaiVariabel(VAR_JENIS_PERKARA) || sebutJenisPerkara(nomor)");
  });

  it("alur dari nomor tinggal menjadi cadangan TERAKHIR", () => {
    const i = abt.indexOf("nilaiVariabel(VAR_JENIS_PERKARA)");
    const blok = abt.slice(i, i + 200);
    expect(blok).toContain("alurPerkaraDariNomor(nomor)");
    expect(blok.indexOf("alurPerkaraDariNomor")).toBeGreaterThan(
      blok.indexOf("sebutJenisPerkara")
    );
  });

  it("namanya berhenti menjanjikan yang tidak dikerjakannya", () => {
    // "jenisPerkaraDariNomor" hanya membaca Pdt.G/Pdt.P - itu alur, bukan
    // jenis. Seluruh perkara Pdt.P berbunyi "Permohonan", entah istbat nikah,
    // dispensasi kawin, atau penetapan ahli waris.
    expect(abt).toContain("function alurPerkaraDariNomor(nomor)");
    expect(abt, "fungsi lama masih dipanggil").not.toContain("jenisPerkaraDariNomor(nomor)");
  });

  it("judul chipnya menyebut dari mana nilainya", () => {
    expect(abt).toContain("variabel 0048");
  });
});
