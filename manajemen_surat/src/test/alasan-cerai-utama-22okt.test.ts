// @vitest-environment node

import { describe, expect, it } from "vitest";

import { arahFaktaHukum, bagianFaktaHukum, usulkanMedanPutusan, type MedanPilihan } from "@/lib/usulan-medan-putusan";

/**
 * Faktor penyebab perceraian POKOK mengikuti arah FAKTA HUKUM (keputusan pengguna 22 Okt 2026).
 *
 * Sebab yang dilaporkan: Putusan Otomatis dan Jadwalkan Putusan berhenti karena faktor pokok selalu
 * "naskah menyebut lebih dari satu" (tidak tercentang, padahal medan itu wajib). Diukur atas 1.055
 * putusan cerai dikabulkan 2025-2026 PA Donggala (server, 22 Okt 2026): sebelum 450 tidak tercentang,
 * sesudah 8 (sisanya pertimbangan tanpa rumusan fakta hukum). Teks di bawah dipetik dari pertimbangan
 * sungguhan, nama dan tempat disamarkan.
 */

const PILIHAN = [
  { nilai: "-1", label: "Pilih Faktor" },
  { nilai: "1", label: "Zina" },
  { nilai: "2", label: "Mabuk" },
  { nilai: "3", label: "Madat" },
  { nilai: "4", label: "Judi" },
  { nilai: "5", label: "Meninggalkan Salah Satu Pihak" },
  { nilai: "6", label: "Dihukum Penjara" },
  { nilai: "7", label: "Kekerasan Dalam Rumah Tangga" },
  { nilai: "8", label: "Cacat Badan" },
  { nilai: "9", label: "Peselisihan dan Pertengkaran Terus Menerus" },
  { nilai: "10", label: "Kawin Paksa" },
  { nilai: "11", label: "Murtad" },
  { nilai: "12", label: "Ekonomi" },
  { nilai: "13", label: "Poligami" },
];
const POKOK: MedanPilihan = { kunci: 'select[name="faktor_cerai"]', label: "Faktor Penyebab Perceraian", pilihan: PILIHAN };
const SEKUNDER: MedanPilihan = {
  kunci: 'select[name="faktor_cerai_sekunder"]',
  label: "Faktor Penyebab Perceraian (Sekunder)",
  pilihan: PILIHAN,
};

const usul = (pertimbangan: string, jenis = "Cerai Gugat") =>
  usulkanMedanPutusan(pertimbangan, [POKOK, SEKUNDER], { jenisPerkara: jenis, pertimbangan });

// 14/Pdt.G/2025 (disamarkan): posita menyebut KDRT, fakta hukum hanya pertengkaran dan pisah.
const KDRT_PEMICU = [
  "Menimbang, bahwa yang menjadi alasan perceraian dalam gugatan Penggugat pada pokoknya bahwa sejak tahun 2022 sering terjadi perselisihan dan pertengkaran yang disebabkan karena Tergugat sering melakukan tindak KDRT kepada Penggugat dan Tergugat malas bekerja;",
  "Menimbang, bahwa berdasarkan analisa bukti-bukti Penggugat ditemukan fakta-fakta hukum sebagai berikut:",
  "Bahwa Penggugat dengan Tergugat pernah hidup rukun, namun sejak tahun 2022 antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran yang berulang-ulang, hingga terjadi pisah tempat tinggal;",
  "Bahwa penyebab kemelut rumah tangga tersebut adalah karena Tergugat sering memukul Penggugat dan Tergugat sering mengonsumsi minuman keras;",
  "Bahwa Penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan Januari 2024 yang hingga kini telah berlangsung selama kurang lebih 1 tahun 11 bulan lamanya;",
  "Menimbang, bahwa tindakan Tergugat yang telah memukul Penggugat menyebabkan lebam di lengan Penggugat merupakan rangkaian puncak pertengkaran, karena itu gugatan Penggugat telah memenuhi Pasal 19 huruf (f) Peraturan Pemerintah Nomor 9 Tahun 1975;",
  "Menimbang, bahwa kekerasan dalam rumah tangga tersebut dikuatkan oleh keterangan kedua saksi yang melihat Tergugat memukul Penggugat;",
].join("\n");

// 617/Pdt.G/2025 dan 26/Pdt.G/2026 (disamarkan): tidak ada pertengkaran, yang diketahui hanya kepergian.
const DITINGGAL_TANPA_PERTENGKARAN = [
  "Menimbang, bahwa saksi-saksi Penggugat menerangkan tidak pernah melihat maupun mendengar Penggugat dan Tergugat bertengkar, yang saksi ketahui Tergugat pergi meninggalkan Penggugat;",
  "Menimbang, bahwa berdasarkan dalil gugatan dihubungkan dengan bukti-bukti, ditemukan fakta hukum sebagai berikut:",
  "Bahwa Penggugat dan Tergugat adalah pasangan suami isteri yang menikah secara sah;",
  "Bahwa sejak akhir tahun 2022 Tergugat telah pergi meninggalkan tempat kediaman bersama;",
  "Bahwa sejak kepergian tersebut sampai dengan perkara ini diperiksa, Tergugat tidak pernah kembali lagi kepada Penggugat;",
  "Bahwa selama kurang lebih 3 (tiga) tahun Tergugat tidak diketahui lagi alamat maupun keberadaannya;",
  "Menimbang, bahwa oleh karena itu gugatan Penggugat telah memenuhi Pasal 19 huruf (f) Peraturan Pemerintah Nomor 9 Tahun 1975;",
].join("\n");

// 367/Pdt.G/2026 (disamarkan): huruf (b) dan (f), angka tahun mendahului "tidak pernah kembali".
const B_DAN_F_TUJUH_TAHUN = [
  "Menimbang, bahwa Majelis Hakim menemukan fakta hukum sebagai berikut:",
  "Penggugat dan Tergugat adalah suami istri sah yang telah dikaruniai 2 (dua) orang anak;",
  "Pada bulan Agustus 2019 Tergugat meninggalkan tempat kediaman bersama dengan alasan bekerja di luar daerah;",
  "Sejak saat itu hingga sekarang, atau kurang lebih 7 (tujuh) tahun berturut-turut, Tergugat tidak pernah kembali dan tidak pernah memberikan nafkah;",
  "Menimbang, bahwa dengan demikian telah terpenuhi Pasal 19 huruf (b) dan huruf (f) Peraturan Pemerintah Nomor 9 Tahun 1975;",
].join("\n");

// 382/Pdt.G/2025 (disamarkan): (b) dan (f), fakta hukum menyebut pertengkaran DAN pisah empat tahun.
const B_DAN_F_BERTENGKAR = [
  "Menimbang, bahwa berdasarkan analisis bukti-bukti di atas ditemukan fakta hukum sebagai berikut:",
  "1. Bahwa sejak awal tahun 2017 Penggugat dan Tergugat sudah sering terjadi pertengkaran dan perselisihan dikarenakan Tergugat sering mengonsumsi obat-obatan terlarang jenis shabu dan tidak pernah memberikan nafkah;",
  "2. Bahwa Penggugat dan Tergugat telah berpisah kediaman bersama sejak bulan Maret 2021 yang hingga kini sudah berpisah selama 4 tahun 2 bulan;",
  "Menimbang, bahwa gugatan Penggugat beralasan hukum sesuai Pasal 19 huruf (b) dan (f) Peraturan Pemerintah Nomor 9 Tahun 1975 jo. Pasal 116 huruf (b) dan (f) Kompilasi Hukum Islam;",
].join("\n");

describe("fakta hukum dipotong dari pertimbangan", () => {
  it("mengambil butir sesudah 'ditemukan fakta hukum sebagai berikut:' sampai Menimbang berikutnya", () => {
    const fh = bagianFaktaHukum(KDRT_PEMICU);
    expect(fh).toMatch(/^Bahwa Penggugat dengan Tergugat pernah hidup rukun/);
    expect(fh).toMatch(/1 tahun 11 bulan lamanya;$/);
    expect(fh).not.toMatch(/alasan perceraian dalam gugatan/);
  });

  it("kalimat yang mengutip SEMA bukan fakta hukum; rumusan sebaris 'terbukti fakta hukum bahwa' dipakai", () => {
    const teks = [
      "Menimbang, bahwa Surat Edaran Mahkamah Agung Nomor 1 Tahun 2022 menyatakan indikator rumah tangga pecah adalah fakta sebagai berikut: pisah rumah dan KDRT",
      "Menimbang, bahwa berdasarkan pertimbangan tersebut di muka, maka telah terbukti fakta hukum bahwa antara Penggugat dan Tergugat telah terjadi pertengkaran secara terus menerus dan tidak ada harapan untuk hidup rukun kembali.",
    ].join("\n");
    expect(bagianFaktaHukum(teks)).toMatch(/^bahwa antara Penggugat dan Tergugat telah terjadi pertengkaran/);
    expect(arahFaktaHukum(teks).adaPertengkaran).toBe(true);
  });

  it("pertengkaran yang diingkari saksi tidak dihitung pertengkaran", () => {
    const arah = arahFaktaHukum(DITINGGAL_TANPA_PERTENGKARAN);
    expect(arah.adaPertengkaran).toBe(false);
    expect(arah.pertengkaranDiingkari).toBe(true);
    expect(arah.pisahDuaTahun).toBe(true);
  });
});

describe("faktor pokok mengikuti arah fakta hukum", () => {
  it("KDRT dan minuman keras sebagai PEMICU pertengkaran: pokok Perselisihan tercentang, pemicunya sekunder", () => {
    const [pokok, sekunder] = usul(KDRT_PEMICU);
    expect(pokok.nilaiLabel).toBe("Peselisihan dan Pertengkaran Terus Menerus");
    expect(pokok.keyakinan).toBe("cukup");
    expect(pokok.alasan).toMatch(/Fakta hukum menyebut perselisihan dan pertengkaran \(pemicunya: mabuk, kekerasan/);
    expect(sekunder.nilaiLabel).toBe("Kekerasan Dalam Rumah Tangga");
    expect(sekunder.keyakinan).toBe("cukup");
  });

  it("saksi tidak pernah melihat/mendengar pertengkaran, Tergugat pergi tiga tahun: Meninggalkan Salah Satu Pihak", () => {
    const [pokok] = usul(DITINGGAL_TANPA_PERTENGKARAN);
    expect(pokok.nilaiLabel).toBe("Meninggalkan Salah Satu Pihak");
    expect(pokok.keyakinan).toBe("cukup");
    expect(pokok.alasan).toMatch(/saksi tidak pernah melihat atau mendengarnya/);
  });

  it("huruf (b)+(f), tujuh tahun berturut-turut tidak kembali tanpa pertengkaran: Meninggalkan", () => {
    const [pokok] = usul(B_DAN_F_TUJUH_TAHUN);
    expect(pokok.nilaiLabel).toBe("Meninggalkan Salah Satu Pihak");
    expect(pokok.keyakinan).toBe("cukup");
  });

  it("huruf (b)+(f) dengan pertengkaran di fakta hukum: Perselisihan, bukan Meninggalkan (dulu Meninggalkan)", () => {
    const [pokok, sekunder] = usul(B_DAN_F_BERTENGKAR);
    expect(pokok.nilaiLabel).toBe("Peselisihan dan Pertengkaran Terus Menerus");
    expect(pokok.keyakinan).toBe("cukup");
    expect(sekunder.nilaiLabel).toBe("Madat");
  });

  it("huruf (d) bersama (f) dengan fakta hukum tetap Kekerasan Dalam Rumah Tangga, tercentang (keputusan 10 Okt: D diusulkan)", () => {
    const teks = KDRT_PEMICU.replace("Pasal 19 huruf (f)", "Pasal 19 huruf (d) dan (f)");
    const [pokok] = usul(teks);
    expect(pokok.nilaiLabel).toBe("Kekerasan Dalam Rumah Tangga");
    expect(pokok.keyakinan).toBe("cukup");
  });

  it("huruf (b) saja tetap pasti Meninggalkan (perilaku lama)", () => {
    const teks = DITINGGAL_TANPA_PERTENGKARAN.replace("Pasal 19 huruf (f)", "Pasal 19 huruf (b)");
    const [pokok] = usul(teks);
    expect(pokok.nilaiLabel).toBe("Meninggalkan Salah Satu Pihak");
    expect(pokok.keyakinan).toBe("pasti");
  });

  it("pertimbangan terpotong tanpa fakta apa pun tetap tidak ditebak", () => {
    const [pokok] = usul(
      "Menimbang, bahwa oleh karena perkara ini termasuk dalam bidang perkawinan, maka biaya perkara dibebankan kepada Pemohon;\nMengingat segala ketentuan peraturan perundang-undangan yang berlaku."
    );
    expect(pokok.nilai).toBe("");
  });
});
