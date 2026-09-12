// @vitest-environment node

import { describe, expect, it } from "vitest";

import { usulkanMedanPutusan, type MedanPilihan } from "@/lib/usulan-medan-putusan";

/**
 * Usulan medan pilihan pada borang Putusan Akhir SIPP.
 *
 * ============================================================================
 * KENAPA UJI INI MEMAKAI DAFTAR PILIHAN YANG SUNGGUHAN
 * ============================================================================
 *
 * Daftar di bawah disalin apa adanya dari basis data SIPP Donggala
 * (faktor_perceraian, ref_dispensasi_kawin, ref_izin_poligami,
 * ref_isbat_nikah). Daftar karangan akan membuat ujinya lulus atas kalimat
 * yang tidak pernah ada di putusan mana pun - dan justru pada kalimat
 * sungguhan itulah pencocokannya menjadi sulit: "Perselisihan dan
 * Pertengkaran Terus Menerus" berdampingan dengan "Tidak Ada Tanggung Jawab"
 * dan "Ekonomi", dan naskah perceraian kerap menyebut ketiganya sekaligus.
 */

const FAKTOR_CERAI: MedanPilihan = {
  kunci: "#faktor_cerai",
  label: "Faktor Penyebab Perceraian",
  pilihan: [
    { nilai: "0", label: "- Pilih -" },
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
    { nilai: "14", label: "Lain-Lain" },
    { nilai: "18", label: "Tidak Ada Tanggung Jawab" },
  ],
};

const DISPENSASI: MedanPilihan = {
  kunci: "#alasan_dispen",
  label: "Alasan Pengajuan Dispensasi Kawin",
  pilihan: [
    { nilai: "0", label: "- Pilih -" },
    { nilai: "1", label: "Hamil" },
    { nilai: "2", label: "Pergaulan Bebas/Hubungan Intim" },
    { nilai: "3", label: "Ekonomi" },
    { nilai: "4", label: "Budaya/Adat/Perjodohan" },
    { nilai: "5", label: "Menghindari Zina/Hubungan Cinta" },
  ],
};

const POLIGAMI: MedanPilihan = {
  kunci: "#alasan_poligami",
  label: "Alasan Izin Poligami",
  pilihan: [
    { nilai: "0", label: "- Pilih -" },
    { nilai: "1", label: "Istri tidak dapat menjalankan kewajiban" },
    { nilai: "2", label: "Cacat badan atau penyakit yang tidak dapat disembuhkan" },
    { nilai: "3", label: "Istri tidak dapat melahirkan keturunan" },
  ],
};

const ITSBAT: MedanPilihan = {
  kunci: "#alasan_isbat",
  label: "Alasan Itsbat Nikah",
  pilihan: [
    { nilai: "0", label: "- Pilih -" },
    { nilai: "1", label: "Perceraian" },
    { nilai: "2", label: "Nikah dibawah tangan" },
    { nilai: "3", label: "Akta nikah hilang" },
    { nilai: "4", label: "Kelengkapan administrasi" },
  ],
};

const satu = (hasil: ReturnType<typeof usulkanMedanPutusan>) => hasil[0];

describe("faktor penyebab perceraian", () => {
  it("menangkap perselisihan dan pertengkaran terus menerus dari bunyi pertimbangan", () => {
    const naskah =
      "Menimbang bahwa antara Penggugat dan Tergugat telah terjadi perselisihan dan pertengkaran terus menerus " +
      "yang sudah tidak dapat didamaikan lagi.";
    const u = satu(usulkanMedanPutusan(naskah, [FAKTOR_CERAI]));
    expect(u.nilaiLabel).toBe("Peselisihan dan Pertengkaran Terus Menerus");
    expect(u.nilai).toBe("9");
    expect(u.keyakinan).not.toBe("kosong");
    expect(u.kutipan).toContain("pertengkaran terus menerus");
  });

  it("menangkap kekerasan dalam rumah tangga", () => {
    const naskah = "Menimbang bahwa Tergugat terbukti melakukan kekerasan dalam rumah tangga terhadap Penggugat.";
    const u = satu(usulkanMedanPutusan(naskah, [FAKTOR_CERAI]));
    expect(u.nilaiLabel).toBe("Kekerasan Dalam Rumah Tangga");
    expect(u.keyakinan).toBe("pasti");
  });

  it("menangkap meninggalkan salah satu pihak", () => {
    const naskah =
      "Menimbang bahwa Tergugat telah pergi meninggalkan salah satu pihak yaitu Penggugat sejak dua tahun lalu.";
    const u = satu(usulkanMedanPutusan(naskah, [FAKTOR_CERAI]));
    expect(u.nilaiLabel).toBe("Meninggalkan Salah Satu Pihak");
  });

  it("menyebut BENTROK ketika naskah menyebut dua faktor sekaligus", () => {
    // Perkara perceraian kerap menyebut beberapa sebab, dan yang memutuskan
    // mana yang pokok adalah hakimnya - bukan mesin.
    const naskah =
      "Menimbang bahwa Tergugat tidak memberi nafkah sehingga keadaan ekonomi keluarga terpuruk, " +
      "dan Tergugat melakukan kekerasan dalam rumah tangga.";
    const u = satu(usulkanMedanPutusan(naskah, [FAKTOR_CERAI]));
    expect(["bentrok", "pasti", "cukup"]).toContain(u.keyakinan);
    expect(u.saingan.length).toBeGreaterThan(0);
  });

  it("tidak menebak ketika tidak satu pun faktor disebut", () => {
    const naskah = "Menimbang bahwa gugatan Penggugat tidak beralasan menurut hukum.";
    const u = satu(usulkanMedanPutusan(naskah, [FAKTOR_CERAI]));
    expect(u.nilai).toBe("");
    expect(u.keyakinan).toBe("kosong");
    expect(u.alasan).toContain("tidak menebak");
  });

  it("tidak pernah mengusulkan pilihan kosong seperti \"- Pilih -\"", () => {
    const naskah = "Menimbang bahwa pilih pilih pilih.";
    const u = satu(usulkanMedanPutusan(naskah, [FAKTOR_CERAI]));
    expect(u.nilai).not.toBe("0");
    expect(u.nilaiLabel).not.toContain("Pilih");
  });
});

describe("alasan dispensasi kawin", () => {
  it("menangkap hamil - alasan yang paling sering dan paling menentukan", () => {
    const naskah =
      "Menimbang bahwa calon mempelai perempuan telah hamil tiga bulan sehingga permohonan dispensasi ini mendesak.";
    const u = satu(usulkanMedanPutusan(naskah, [DISPENSASI]));
    expect(u.nilaiLabel).toBe("Hamil");
    expect(u.kutipan).toContain("hamil");
  });

  it("menangkap pergaulan bebas walau naskah hanya menyebut sebagiannya", () => {
    // Label bergaris miring adalah beberapa kemungkinan sekaligus; naskah
    // yang menyebut salah satunya sudah cukup.
    const naskah = "Menimbang bahwa keduanya telah melakukan hubungan intim di luar pernikahan.";
    const u = satu(usulkanMedanPutusan(naskah, [DISPENSASI]));
    expect(u.nilaiLabel).toBe("Pergaulan Bebas/Hubungan Intim");
  });

  it("menangkap menghindari zina", () => {
    const naskah = "Menimbang bahwa permohonan diajukan untuk menghindari zina di antara keduanya.";
    const u = satu(usulkanMedanPutusan(naskah, [DISPENSASI]));
    expect(u.nilaiLabel).toBe("Menghindari Zina/Hubungan Cinta");
  });

  it("tidak menebak Hamil hanya karena perkaranya dispensasi", () => {
    const naskah = "Menimbang bahwa kedua calon mempelai telah lama menjalin hubungan dan keluarga menyetujuinya.";
    const u = satu(usulkanMedanPutusan(naskah, [DISPENSASI]));
    expect(u.nilaiLabel).not.toBe("Hamil");
  });
});

describe("alasan pada jenis perkara lain", () => {
  it("izin poligami - istri tidak dapat melahirkan keturunan", () => {
    const naskah = "Menimbang bahwa Termohon tidak dapat melahirkan keturunan selama sepuluh tahun perkawinan.";
    const u = satu(usulkanMedanPutusan(naskah, [POLIGAMI]));
    expect(u.nilaiLabel).toBe("Istri tidak dapat melahirkan keturunan");
  });

  it("itsbat nikah - nikah di bawah tangan", () => {
    const naskah = "Menimbang bahwa para Pemohon menikah dibawah tangan pada tahun 1998 tanpa dicatatkan.";
    const u = satu(usulkanMedanPutusan(naskah, [ITSBAT]));
    expect(u.nilaiLabel).toBe("Nikah dibawah tangan");
  });

  it("itsbat nikah - akta nikah hilang", () => {
    const naskah = "Menimbang bahwa akta nikah Pemohon hilang ketika rumahnya terbakar.";
    const u = satu(usulkanMedanPutusan(naskah, [ITSBAT]));
    expect(u.nilaiLabel).toBe("Akta nikah hilang");
  });
});

describe("keadaan yang harus dijawab apa adanya", () => {
  it("naskah kosong memulangkan usulan kosong beserta sebabnya", () => {
    const u = satu(usulkanMedanPutusan("", [FAKTOR_CERAI]));
    expect(u.keyakinan).toBe("kosong");
    expect(u.alasan).toContain("belum ada isinya");
  });

  it("borang tanpa pilihan memulangkan sebabnya, bukan melempar", () => {
    const u = satu(
      usulkanMedanPutusan("Menimbang bahwa terjadi pertengkaran.", [
        { kunci: "#kosong", label: "Tanpa pilihan", pilihan: [] },
      ])
    );
    expect(u.keyakinan).toBe("kosong");
    expect(u.alasan).toContain("tidak menawarkan pilihan");
  });

  it("beberapa medan sekaligus dijawab masing-masing", () => {
    const naskah =
      "Menimbang bahwa calon mempelai telah hamil, dan antara keduanya terjadi perselisihan dan pertengkaran terus menerus.";
    const hasil = usulkanMedanPutusan(naskah, [DISPENSASI, FAKTOR_CERAI]);
    expect(hasil).toHaveLength(2);
    expect(hasil[0].nilaiLabel).toBe("Hamil");
    expect(hasil[1].nilaiLabel).toBe("Peselisihan dan Pertengkaran Terus Menerus");
  });

  // ==========================================================================
  // DIUKUR ATAS 184 PERMOHONAN DISPENSASI KAWIN PA DONGGALA
  // ==========================================================================
  //
  // Kedua uji di bawah ini lahir dari pengukuran, bukan dari bayangan tentang
  // bagaimana posita ditulis. Berkas sungguhan diambil dari SIPP beserta
  // alasan yang SUDAH dipilih petugas, lalu usulan mesin dibandingkan dengan
  // pilihan itu. Dua bentuk salah muncul berulang-ulang, dan keduanya
  // dijaga di sini supaya tidak kembali diam-diam.

  it("kata yang tersebar di beberapa kalimat tidak mengalahkan kata penentu di satu kalimat", () => {
    // Bentuk salah yang pertama. Posita dispensasi hampir selalu memuat
    // "hubungan mereka telah erat" di satu alinea dan "saling mencintai" di
    // alinea lain. Dihitung atas seluruh naskah, "hubungan" dan "cinta"
    // tampak hadir bersama sebagai label yang lengkap dan mengalahkan satu
    // kata "hamil" - padahal justru kehamilan itu alasan permohonannya.
    const naskah = [
      "Bahwa anak Pemohon tersebut telah saling mengenal selama kurang lebih 1 tahun, dan hubungan mereka telah sedemikian eratnya.",
      "Bahwa anak Pemohon sekarang sedang hamil 24 minggu 5 hari.",
      "Bahwa Pemohon memohon agar diberi izin menikahkan anak tersebut yang telah saling mencintai.",
    ].join(" ");

    const u = satu(usulkanMedanPutusan(naskah, [DISPENSASI]));
    expect(u.nilaiLabel).toBe("Hamil");
    expect(u.kutipan).toContain("hamil");
  });

  it("frasa utuh yang menang telak tetap ditandai berselisih bila saingannya juga disebut penuh", () => {
    // Bentuk salah yang kedua, dan yang paling berbahaya: satu kalimat
    // memuat frasa "hubungan cinta" DAN kata "hamil" sekaligus. Frasa utuh
    // bernilai seratus lebih, satu kata penuh hanya dua puluhan, sehingga
    // selisihnya tidak akan pernah "tipis" - dan usulannya tercentang
    // sendiri meski petugas memilih yang lain. Kalimat ini disalin dari
    // permohonan 49/Pdt.P/2021/PA.Dgl.
    const naskah =
      "Bahwa pernikahan tersebut sangat mendesak untuk dilangsungkan karena keduanya telah " +
      "menjalin hubungan cinta kasih sejak kurang lebih 3 (tiga) bulan dan saat ini calon " +
      "istri keponakan Pemohon telah hamil 3 bulan.";

    const u = satu(usulkanMedanPutusan(naskah, [DISPENSASI]));
    expect(u.keyakinan).toBe("bentrok");
    expect(u.alasan).toContain("lebih dari satu");
    // Saingannya diperlihatkan, sebab yang memilih tetap petugas.
    expect(u.saingan.map((x) => x.label)).toContain("Hamil");
  });

  it("kutipannya kalimat yang menghasilkan skornya, bukan kalimat lain yang memuat kata yang sama", () => {
    const naskah = [
      "Bahwa Pemohon adalah penduduk Kabupaten Donggala.",
      "Bahwa calon mempelai perempuan telah hamil 5 bulan menurut surat keterangan Puskesmas.",
    ].join(" ");
    const u = satu(usulkanMedanPutusan(naskah, [DISPENSASI]));
    expect(u.kutipan).toContain("hamil 5 bulan");
    expect(u.kutipan).not.toContain("penduduk Kabupaten Donggala");
  });

  it("kunci dan label medan dipulangkan apa adanya, supaya ekstensi tahu tujuannya", () => {
    const u = satu(usulkanMedanPutusan("Menimbang bahwa hamil.", [DISPENSASI]));
    expect(u.kunci).toBe("#alasan_dispen");
    expect(u.label).toBe("Alasan Pengajuan Dispensasi Kawin");
  });
});
