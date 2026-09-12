// @vitest-environment node

import { describe, expect, it } from "vitest";

import { usulkanMedanPutusan, type MedanPilihan } from "@/lib/usulan-medan-putusan";

/**
 * Medan yang jawabannya tidak pernah dihitung dari banyaknya kata.
 *
 * Empat di antara medan borang Putusan Akhir punya BAWAAN - jawaban yang
 * berlaku ketika naskahnya diam - dan bawaannya bukan "kosong":
 *
 *   Status Nusyuz    Tidak Nusyuz, kecuali pertimbangan menuduh isterinya.
 *   Qobla/Ba'da      Ba'da Dukhul, kecuali disebut belum pernah berkumpul.
 *   Keadaan Isteri   Suci pada cerai gugat, Tidak Diketahui pada cerai talak.
 *   Putusan Verstek  Tidak, kecuali amarnya menyebut verstek.
 *
 * Diamnya naskah BUKAN ketidaktahuan pada keempatnya - ia keterangan
 * tersendiri. Putusan yang tidak menyatakan isterinya nusyuz berarti isterinya
 * tidak nusyuz, dan hak nafkah iddahnya utuh.
 *
 * Dan satu lagi yang hanya kelihatan bila kedua medan faktor perceraian
 * dipandang bersama: yang sekunder tidak boleh mengulang yang pokok.
 */

const NUSYUZ: MedanPilihan = {
  kunci: 'input[name="status_nusyuz"]',
  label: "Status Nusyuz",
  pilihan: [
    { nilai: "1", label: "Nusyuz" },
    { nilai: "0", label: "Tidak Nusyuz" },
  ],
};

const QOBLA: MedanPilihan = {
  kunci: 'select[name="qobla"]',
  label: "Qobla/Ba'da Dukhul",
  pilihan: [
    { nilai: "1", label: "Qobla Dukhul" },
    { nilai: "2", label: "Ba'da Dukhul" },
  ],
};

const KEADAAN_ISTRI: MedanPilihan = {
  kunci: 'select[name="keadaan_istri"]',
  label: "Keadaan Istri",
  pilihan: [
    { nilai: "", label: "Pilih Keadaan Istri" },
    { nilai: "1", label: "Suci" },
    { nilai: "2", label: "Hamil" },
    { nilai: "3", label: "Tidak Diketahui" },
  ],
};

const FAKTOR = (kunci: string, label: string): MedanPilihan => ({
  kunci,
  label,
  pilihan: [
    { nilai: "", label: "Pilih Faktor" },
    { nilai: "5", label: "Ekonomi" },
    { nilai: "9", label: "Meninggalkan Salah Satu Pihak" },
    { nilai: "12", label: "Perselisihan Dan Pertengkaran Terus Menerus" },
  ],
});

const FAKTOR_POKOK = FAKTOR('select[name="faktor_cerai"]', "Faktor Penyebab Perceraian");
const FAKTOR_SEKUNDER = FAKTOR(
  'select[name="faktor_cerai_sekunder"]',
  "Faktor Penyebab Perceraian (Sekunder)"
);

/** Alinea penutup pertimbangan pada perkara 492 - susunannya apa adanya. */
const ALINEA_PASAL =
  "Menimbang, bahwa atas dasar pertimbangan-pertimbangan tersebut di atas, Majelis Hakim berpendapat rumah tangga Penggugat dan Tergugat benar-benar telah pecah (break down marriage) sehingga tidak mungkin dipersatukan kembali karena perselisihan terus menerus dan Tergugat telah meninggalkan selama 2 (dua) tahun berturut-turut tanpa izin dari Penggugat. Dengan demikian, telah terpenuhi ketentuan Pasal 39 ayat (2) Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 19 huruf (b) dan (f) Peraturan Pemerintah Nomor 9 Tahun 1975 jo. Pasal 116 huruf (b) dan (f) Kompilasi Hukum Islam, berdasarkan petitum angka 2 gugatan Penggugat beralasan hukum dan patut dikabulkan;";

const NASKAH_492 = [
  "- Bahwa yang menjadi penyebab perselisihan dan pertengkaran antara Penggugat dan Tergugat adalah masalah ekonomi, disebabkan Tergugat enggan bekerja sehingga nafkah yang diberikan kepada Penggugat tidak mencukupi;",
  "Menimbang, bahwa Tergugat pergi meninggalkan tempat tinggal bersama dan tidak pernah kembali lagi;",
  ALINEA_PASAL,
].join("\n");

const satu = (naskah: string, medan: MedanPilihan, jenis = "") =>
  usulkanMedanPutusan(naskah, [medan], jenis)[0];

describe("Status Nusyuz", () => {
  it("bawaannya Tidak Nusyuz ketika naskahnya diam", () => {
    const usul = satu(NASKAH_492, NUSYUZ);
    expect(usul.nilaiLabel).toBe("Tidak Nusyuz");
    expect(usul.keyakinan).toBe("cukup");
    expect(usul.alasan).toContain("Periksa sendiri");
  });

  it("memilih Nusyuz ketika pertimbangan menuduh isterinya", () => {
    const naskah =
      "Menimbang, bahwa Penggugat terbukti nusyuz karena meninggalkan kediaman bersama tanpa izin Tergugat;";
    const usul = satu(naskah, NUSYUZ);
    expect(usul.nilaiLabel).toBe("Nusyuz");
    expect(usul.keyakinan).toBe("pasti");
  });

  it("tidak tertipu uraian hukum yang menyebut nusyuz tanpa menuduh siapa pun", () => {
    // Kalimat semacam ini berdiri di banyak pertimbangan sebagai penjelasan
    // pasal. Membacanya sebagai tuduhan menggugurkan hak nafkah iddah
    // seseorang atas dasar kalimat yang tidak menyebutnya sama sekali.
    const naskah =
      "Menimbang, bahwa suami wajib memberi nafkah iddah kepada bekas isterinya sepanjang bekas isteri tidak berbuat nusyuz;";
    const usul = satu(naskah, NUSYUZ);
    expect(usul.nilaiLabel).toBe("Tidak Nusyuz");
  });
});

describe("Qobla/Ba'da Dukhul", () => {
  it("bawaannya Ba'da Dukhul", () => {
    const usul = satu(NASKAH_492, QOBLA);
    expect(usul.nilaiLabel).toBe("Ba'da Dukhul");
  });

  it("memilih Qobla ketika disebut belum pernah berkumpul", () => {
    const naskah =
      "Menimbang, bahwa Penggugat dan Tergugat belum pernah berkumpul sebagaimana layaknya suami isteri (qobla dukhul);";
    const usul = satu(naskah, QOBLA);
    expect(usul.nilaiLabel).toBe("Qobla Dukhul");
    expect(usul.keyakinan).toBe("pasti");
  });
});

describe("Keadaan Isteri", () => {
  it("Suci pada cerai gugat", () => {
    const usul = satu(NASKAH_492, KEADAAN_ISTRI, "Cerai Gugat");
    expect(usul.nilaiLabel).toBe("Suci");
    expect(usul.alasan).toContain("Cerai Gugat");
  });

  it("Tidak Diketahui pada cerai talak", () => {
    // Yang berperkara suaminya; keadaan isteri tidak ditanyakan majelis dan
    // memang tidak ada di berkas.
    const usul = satu(NASKAH_492, KEADAAN_ISTRI, "Cerai Talak");
    expect(usul.nilaiLabel).toBe("Tidak Diketahui");
  });

  it("yang tertulis mengalahkan bawaan jenis perkaranya", () => {
    const naskah = "Menimbang, bahwa Penggugat menerangkan dirinya sedang hamil 3 bulan;";
    const usul = satu(naskah, KEADAAN_ISTRI, "Cerai Gugat");
    expect(usul.nilaiLabel).toBe("Hamil");
    expect(usul.keyakinan).toBe("pasti");
  });

  it("tanpa jenis perkara, jatuh ke jawaban tidak-nya", () => {
    const usul = satu(NASKAH_492, KEADAAN_ISTRI);
    expect(usul.nilai).toBeTruthy();
    expect(usul.keyakinan).toBe("cukup");
  });
});

describe("faktor perceraian: pokok dan sekunder", () => {
  it("kepergian dua tahun mendahului ekonomi dan perselisihan", () => {
    // Posita menguraikan ekonomi panjang lebar, tetapi yang menjadi dasar
    // hukumnya Pasal 19 huruf (b) - dua tahun berturut-turut.
    const [pokok] = usulkanMedanPutusan(NASKAH_492, [FAKTOR_POKOK]);
    expect(pokok.nilaiLabel).toBe("Meninggalkan Salah Satu Pihak");
    expect(pokok.alasan).toContain("huruf (b)");
  });

  it("yang semula pokok turun menjadi saingan, bukan hilang", () => {
    const [pokok] = usulkanMedanPutusan(NASKAH_492, [FAKTOR_POKOK]);
    expect(pokok.saingan.map((x) => x.label)).toContain("Ekonomi");
  });

  it("sekunder tidak pernah mengulang pokoknya", () => {
    const hasil = usulkanMedanPutusan(NASKAH_492, [FAKTOR_POKOK, FAKTOR_SEKUNDER]);
    const [pokok, sekunder] = hasil;
    expect(pokok.nilai).toBeTruthy();
    expect(sekunder.nilai).not.toBe(pokok.nilai);
  });

  it("sekunder dikosongkan bila naskahnya hanya menyebut satu faktor", () => {
    // Sengaja tanpa kata "perselisihan" - naskah yang memuatnya memang
    // menyebut dua faktor, dan sekundernya pantas terisi.
    const satuFaktor =
      "Menimbang, bahwa satu-satunya sebab rumah tangga keduanya goyah adalah masalah ekonomi;";
    const hasil = usulkanMedanPutusan(satuFaktor, [FAKTOR_POKOK, FAKTOR_SEKUNDER]);
    expect(hasil[0].nilaiLabel).toBe("Ekonomi");
    expect(hasil[1].nilai).toBe("");
    expect(hasil[1].alasan).toContain("sudah menjadi pokok");
  });

  it("tidak menyentuh apa pun bila kepergian dua tahun tidak disebut", () => {
    const tanpaPergi =
      "Menimbang, bahwa penyebab perselisihan Penggugat dan Tergugat adalah masalah ekonomi, dan pertengkaran terus menerus terjadi;";
    const [pokok] = usulkanMedanPutusan(tanpaPergi, [FAKTOR_POKOK]);
    expect(pokok.nilaiLabel).not.toBe("Meninggalkan Salah Satu Pihak");
  });
});

describe("sumber hukum pada alinea pasal", () => {
  it("ketiganya terbaca dari satu alinea penutup pertimbangan", () => {
    // Inilah bentuk alinea tempat sumber hukum selalu muncul: sesudah
    // pertimbangan fakta, majelis menyebut pasal-pasalnya sekaligus.
    const sumber: MedanPilihan = {
      kunci: 'input[name="sumber_hukum[]"]',
      label: "Sumber Hukum",
      banyak: true,
      pilihan: [
        { nilai: "10", label: "Fiqh Islam" },
        { nilai: "8", label: "Kompilasi Hukum Islam" },
        { nilai: "11", label: "UU/PP" },
        { nilai: "14", label: "Yurisprudensi" },
      ],
    };
    const usul = satu(ALINEA_PASAL, sumber);
    const label = (usul.nilaiBanyak ?? []).map((x) => x.label).sort();
    expect(label).toEqual(["Kompilasi Hukum Islam", "UU/PP"]);
    expect(label).not.toContain("Yurisprudensi");
  });
});
