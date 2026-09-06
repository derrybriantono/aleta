import { describe, expect, it } from "vitest";

import {
  bersihkanHtml,
  daftarBerkas,
  isianKurang,
  pilihanAwal,
  sebutanPihak,
  susunPrompt,
  type BahanPrompt,
} from "@/lib/prompt-putusan";

/**
 * Bahan uji ini BUKAN karangan.
 *
 * Seluruh angka dan namanya disalin dari perkara 359/Pdt.G/2026/PA.Dgl pada
 * SIPP yang berjalan - jadwal sidangnya, tanggal mediasinya, kode hasilnya,
 * dan kedua nama saksinya. Perkara itu pula yang dipakai penyusun sebagai
 * contoh perintah, sehingga hasil rangkaian di sini dapat dibandingkan
 * langsung dengan perintah yang selama ini ditulis tangan.
 */
function bahan359(): BahanPrompt {
  return {
    ok: true,
    identitas: {
      perkaraId: "9862",
      nomorPerkara: "359/Pdt.G/2026/PA.Dgl",
      jenisPerkara: "Cerai Talak",
      tanggalDaftar: "2026-06-11",
      gugatan: true,
    },
    pihak: {
      penggugat: [{ nama: "Ewardin bin Lasan", alamat: "Donggala" }],
      tergugat: [{ nama: "Nurhayati binti Salam", alamat: "Donggala" }],
    },
    kuasa: [],
    sidang: [
      { tanggal: "2026-06-25", tanggalTerbaca: "25 Juni 2026", agenda: "Sidang Pertama", alasanDitunda: "Proses Mediasi", kehadiran: "kedua pihak hadir" },
      { tanggal: "2026-07-09", tanggalTerbaca: "9 Juli 2026", agenda: "Proses Mediasi", alasanDitunda: "Jawaban Termohon", kehadiran: "kedua pihak hadir" },
      { tanggal: "2026-07-15", tanggalTerbaca: "15 Juli 2026", agenda: "Jawaban Termohon", alasanDitunda: "Termohon telah upload Jawaban", kehadiran: "kedua pihak hadir" },
      { tanggal: "2026-07-20", tanggalTerbaca: "20 Juli 2026", agenda: "Replik Pemohon", alasanDitunda: "Duplik Termohon", kehadiran: "kedua pihak hadir" },
      { tanggal: "2026-07-22", tanggalTerbaca: "22 Juli 2026", agenda: "Duplik Termohon", alasanDitunda: "Pembuktian", kehadiran: "kedua pihak hadir" },
      { tanggal: "2026-07-28", tanggalTerbaca: "28 Juli 2026", agenda: "Pembuktian", alasanDitunda: "Musyawarah Majelis", kehadiran: "kedua pihak hadir" },
      { tanggal: "2026-08-11", tanggalTerbaca: "11 Agustus 2026", agenda: "Pembacaan putusan", alasanDitunda: "putus DIKABULKAN", kehadiran: "kedua pihak hadir" },
    ],
    mediasi: {
      ada: true,
      mediator: "Himawan Tatura Wijaya, S.H.I., M.H.",
      tanggalMulai: "2026-06-25",
      tanggalMulaiTerbaca: "25 Juni 2026",
      tanggalLaporan: "2026-07-08",
      tanggalLaporanTerbaca: "8 Juli 2026",
      tanggalKesepakatan: "2026-07-08",
      tanggalKesepakatanTerbaca: "8 Juli 2026",
      kodeHasil: "S",
      hasilTerbaca: "berhasil sebagian",
      isiKesepakatan:
        "<ol>\n <li><strong>Juni 2026 </strong>yang bertempat di ruang mediasi telah menghasilkan kesepakatan sebagian;</li>\n <li>Bahwa biaya mediasi sebesar Rp.29.500,-&nbsp;dibebankan kepada Pihak I;</li>\n</ol>",
      biaya: [],
    },
    saksi: [
      { nama: "Aswadi bin Arni", pihak: "Penggugat/Pemohon" },
      { nama: "Abd. Salam bin Udin", pihak: "Penggugat/Pemohon" },
    ],
    /**
     * Bentuk dan nama berkasnya disalin dari arsip e-Court yang berjalan -
     * termasuk pola nama "Judul__sidikjari.ext" yang dipakai penyimpanannya.
     *
     * Butir ketiga sengaja TERCATAT TAPI BELUM TERUNDUH (nama berkas kosong),
     * karena itulah keadaan seluruh 394 dokumen sesudah folder unduhannya
     * terhapus oleh pembangunan ulang container.
     */
    berkas: [
      {
        judul: "SURAT GUGATAN (Docx/Rtf)",
        jenis: "gugatan",
        diunggahOleh: "pihak",
        tanggalSidang: "",
        agenda: "Sidang Pertama",
        adaPdf: false,
        adaWord: true,
        namaBerkasPdf: "",
        namaBerkasWord: "SURAT GUGATAN (DocxRtf)__afdc3c67.docx",
      },
      {
        judul: "Jawaban Termohon",
        jenis: "persidangan",
        diunggahOleh: "pihak",
        tanggalSidang: "2026-07-15",
        agenda: "Jawaban Termohon",
        adaPdf: true,
        adaWord: false,
        namaBerkasPdf: "Jawaban Termohon__29db9d4f.pdf",
        namaBerkasWord: "",
      },
      {
        judul: "BAS Pembuktian",
        jenis: "bas",
        diunggahOleh: "pengadilan",
        tanggalSidang: "2026-07-28",
        agenda: "Pembuktian",
        adaPdf: false,
        adaWord: false,
        namaBerkasPdf: "",
        namaBerkasWord: "",
      },
    ],
    putusan: { tanggalPutusan: "2026-08-11", verstek: false, adaAmar: true },
  };
}

describe("bersihkanHtml", () => {
  it("mengubah daftar HTML SIPP menjadi butir teks biasa", () => {
    const hasil = bersihkanHtml(bahan359().mediasi.isiKesepakatan);
    expect(hasil).not.toContain("<");
    expect(hasil).not.toContain("&nbsp;");
    expect(hasil.split("\n")).toHaveLength(2);
    expect(hasil.split("\n")[1]).toBe("- Bahwa biaya mediasi sebesar Rp.29.500,- dibebankan kepada Pihak I;");
  });

  it("membaca bentuk <p><strong>Pasal 1</strong></p> yang dipakai perkara lain", () => {
    // Perkara 9956 menyimpan pasal-pasalnya dengan bentuk ini, bukan <ol>.
    const hasil = bersihkanHtml(
      "<p><strong>Pasal 1</strong></p>\n\n<p>Para Pihak sepakat mengakhiri konflik.</p>\n<p>&nbsp;</p>"
    );
    expect(hasil).toBe("Pasal 1\nPara Pihak sepakat mengakhiri konflik.");
  });

  it("tidak jatuh pada masukan kosong", () => {
    expect(bersihkanHtml("")).toBe("");
  });
});

describe("sebutanPihak", () => {
  it("memakai Pemohon/Termohon pada cerai talak", () => {
    expect(sebutanPihak(bahan359())).toEqual({ satu: "Pemohon", dua: "Termohon" });
  });

  it("memakai Penggugat/Tergugat pada cerai gugat", () => {
    const b = bahan359();
    b.identitas.jenisPerkara = "Cerai Gugat";
    expect(sebutanPihak(b)).toEqual({ satu: "Penggugat", dua: "Tergugat" });
  });

  it("memakai Pemohon/Termohon pada perkara Pdt.P", () => {
    const b = bahan359();
    b.identitas.jenisPerkara = "Itsbat Nikah";
    b.identitas.nomorPerkara = "12/Pdt.P/2026/PA.Dgl";
    expect(sebutanPihak(b).satu).toBe("Pemohon");
  });
});

describe("pilihanAwal", () => {
  it("menerjemahkan kode mediasi S menjadi berhasil sebagian", () => {
    expect(pilihanAwal(bahan359()).hasilMediasi).toBe("berhasil-sebagian");
  });

  it("membiarkan kode yang tidak baku KOSONG agar penyusun sadar ia memilih", () => {
    // 'Y2' (45 baris) dan 'D' (22 baris) ada di SIPP tanpa arti yang pasti.
    const b = bahan359();
    b.mediasi.kodeHasil = "Y2";
    expect(pilihanAwal(b).hasilMediasi).toBe("");
  });

  it("menyatakan tidak ada mediasi ketika memang tidak ada barisnya", () => {
    const b = bahan359();
    b.mediasi.ada = false;
    b.mediasi.kodeHasil = "";
    expect(pilihanAwal(b).hasilMediasi).toBe("tidak-ada");
  });

  it("mengisi sendiri isi kesepakatan dalam bentuk yang sudah bersih", () => {
    expect(pilihanAwal(bahan359()).isiKesepakatan).not.toContain("<li>");
  });

  it("menandai adanya agenda replik dan duplik dari jadwal SIPP", () => {
    const awal = pilihanAwal(bahan359());
    expect(awal.adaReplik).toBe(true);
    expect(awal.adaDuplik).toBe(true);
  });
});

describe("susunPrompt", () => {
  const susun = (ubah: Partial<ReturnType<typeof pilihanAwal>> = {}) => {
    const b = bahan359();
    return susunPrompt(b, {
      ...pilihanAwal(b),
      arahPutusan: "kabul",
      berkasBlangko: "359_Pdt.G_2026_PA.Dgl - [02] [Kabul] CT - F.rtf",
      berkasAcuan: "274_Pdt.G_2026_PA.Dgl - [02] [Kabul] CT - F.rtf.doc",
      buktiSurat: "P.1 berupa KTP dan P.2 berupa Kutipan Akta Nikah",
      adaReplik: false,
      ...ubah,
    });
  };

  it("memuat kelima bagian A sampai E", () => {
    const teks = susun();
    for (const judul of [
      "**A. ARAH PUTUSAN & ANALISA AWAL**",
      "**B. ATURAN PENYUSUNAN DUDUK PERKARA & PERTIMBANGAN HUKUM**",
      "**C. ATURAN KETERANGAN SAKSI & PEMBUKTIAN**",
      "**D. PENGGUNAAN FILE BLANGKO & OUTPUT AKHIR (FULL PUTUSAN)**",
      "**E. DAFTAR LAMPIRAN FILE (Sebagai dasar analisa):**",
    ]) {
      expect(teks).toContain(judul);
    }
  });

  it("menyalin jadwal sidang SIPP apa adanya, termasuk alasan penundaan", () => {
    const teks = susun();
    expect(teks).toContain("* 25 Juni 2026: Sidang Pertama (Ditunda: Proses Mediasi)");
    expect(teks).toContain("* 11 Agustus 2026: Pembacaan putusan (Ditunda: putus DIKABULKAN)");
  });

  it("menyebut mediator dan tanggal laporan mediasi dari SIPP", () => {
    const teks = susun();
    expect(teks).toContain("Himawan Tatura Wijaya, S.H.I., M.H.");
    expect(teks).toContain("laporan hasil mediasi tertanggal 8 Juli 2026");
  });

  it("menyebut kedua saksi dengan nama dan jumlahnya terbilang", () => {
    const teks = susun();
    expect(teks).toContain("2 (dua) orang saksi Pemohon (Aswadi bin Arni dan Abd. Salam bin Udin)");
  });

  it("menunjuk dokumen BAS lewat judulnya selama berkasnya belum terunduh", () => {
    expect(susun()).toContain('langsung dari dokumen "BAS Pembuktian"');
  });

  it("menunjuk nama berkas BAS begitu berkasnya terunduh", () => {
    const b = bahan359();
    const bas = b.berkas.find((x) => x.judul === "BAS Pembuktian");
    if (bas) {
      bas.adaPdf = true;
      bas.namaBerkasPdf = "PADgl_2026_PdtG_359_bas_6_1785209801.pdf";
    }
    const teks = susunPrompt(b, { ...pilihanAwal(b), arahPutusan: "kabul" });
    expect(teks).toContain("`PADgl_2026_PdtG_359_bas_6_1785209801.pdf`");
  });

  it("mencatat replik tidak ada ketika agendanya dicabut penyusun", () => {
    const teks = susun({ adaReplik: false });
    expect(teks).toContain("Replik Pemohon tidak ada");
    expect(teks).not.toContain("Ekstrak bagian posita dari file Gugatan/Permohonan, Jawaban Termohon, Replik");
  });

  it("mematikan seluruh sebutan rekonvensi ketika perkaranya murni konvensi", () => {
    const teks = susun({ adaRekonvensi: false });
    expect(teks).toContain("murni Konvensi dan tidak ada gugatan Rekonvensi");
    expect(teks).toContain('"Pemohon" dan "Termohon" di seluruh uraian, karena tidak ada rekonvensi');
  });

  it("berbalik seluruhnya ketika rekonvensi dicentang", () => {
    const teks = susun({ adaRekonvensi: true });
    expect(teks).toContain("memuat gugatan Rekonvensi");
    expect(teks).not.toContain("Abaikan segala hal dan format yang berkaitan dengan rekonvensi");
  });

  it("menyatakan pihak hadir sendiri ketika SIPP tidak mencatat kuasa", () => {
    expect(susun()).toContain("hadir menghadap sendiri (prinsipal)");
  });

  it("menyebut nama kuasa ketika SIPP mencatatnya", () => {
    const b = bahan359();
    b.kuasa = [{ nama: "Amit Suaib, S.H.", klien: "Ewardin bin Lasan", pihak: "Penggugat/Pemohon" }];
    const teks = susunPrompt(b, { ...pilihanAwal(b), arahPutusan: "kabul" });
    expect(teks).toContain("Amit Suaib, S.H.");
    expect(teks).not.toContain("hadir menghadap sendiri");
  });

  it("menghilangkan seluruh bagian mediasi ketika tidak ada mediasi", () => {
    const b = bahan359();
    b.mediasi.ada = false;
    b.mediasi.kodeHasil = "";
    b.mediasi.isiKesepakatan = "";
    const teks = susunPrompt(b, { ...pilihanAwal(b), arahPutusan: "kabul" });
    expect(teks).not.toContain("Riwayat Mediasi");
    expect(teks).not.toContain("Himawan");
  });

  it("menyatakan arah putusan belum ditentukan alih-alih mengarang", () => {
    const b = bahan359();
    const teks = susunPrompt(b, { ...pilihanAwal(b), arahPutusan: "" });
    expect(teks).toContain("BELUM DITENTUKAN");
  });

  it("tidak pernah menyisakan baris kosong beruntun", () => {
    expect(susun()).not.toMatch(/\n{3,}/);
  });

  it("menutup dengan permintaan draf dan tautan unduhan", () => {
    expect(susun().trimEnd().endsWith("beserta tautan unduhan dokumennya.")).toBe(true);
  });

  it("tidak menyeret sisa tanda HTML ke dalam perintah", () => {
    const teks = susun();
    expect(teks).not.toContain("<li>");
    expect(teks).not.toContain("&nbsp;");
  });
});

describe("daftarBerkas", () => {
  it("memakai nama berkas sungguhan ketika berkasnya sudah terunduh", () => {
    const daftar = daftarBerkas(bahan359());
    expect(daftar).toHaveLength(3);
    expect(daftar[0].nama).toBe("SURAT GUGATAN (DocxRtf)__afdc3c67.docx");
    expect(daftar[0].berkasNyata).toBe(true);
    expect(daftar[0].penjelas).toBe("SURAT GUGATAN (Docx/Rtf) - Sidang Pertama - Word");
  });

  it("turun ke judul dokumen ketika berkasnya belum terunduh", () => {
    // Menuliskannya seperti nama berkas membuat pembacanya mencari berkas
    // yang tidak ada - dan sesudah folder unduhan terhapus, itu keadaan
    // hampir seluruh dokumen.
    const bas = daftarBerkas(bahan359()).find((x) => x.nama === "BAS Pembuktian");
    expect(bas?.berkasNyata).toBe(false);
  });

  it("tidak mengulang judul yang sama persis dengan agendanya", () => {
    const duplik = daftarBerkas(bahan359()).find((x) => x.nama.startsWith("Jawaban Termohon__"));
    expect(duplik?.penjelas).toBe("Jawaban Termohon - PDF");
  });

  it("memberi tahu bila ada butir yang bukan nama berkas", () => {
    const b = bahan359();
    const teks = susunPrompt(b, { ...pilihanAwal(b), arahPutusan: "kabul" });
    expect(teks).toContain("bukan nama berkasnya");
  });

  it("diam ketika seluruh berkasnya sudah terunduh", () => {
    const b = bahan359();
    b.berkas = b.berkas.filter((x) => x.namaBerkasPdf || x.namaBerkasWord);
    const teks = susunPrompt(b, { ...pilihanAwal(b), arahPutusan: "kabul" });
    expect(teks).not.toContain("bukan nama berkasnya");
  });

  it("melewati dokumen yang judulnya kosong dan tanpa berkas", () => {
    const b = bahan359();
    b.berkas.push({
      judul: "   ",
      jenis: "lain",
      diunggahOleh: "",
      tanggalSidang: "",
      agenda: "",
      adaPdf: false,
      adaWord: false,
      namaBerkasPdf: "",
      namaBerkasWord: "",
    });
    expect(daftarBerkas(b)).toHaveLength(3);
  });

  it("dokumen yang ada di arsip benar-benar sampai ke daftar lampiran", () => {
    // Pernah keluar KOSONG pada perkara yang dokumennya justru lengkap,
    // karena ruas nama berkas yang dibaca tidak pernah dipulangkan layanan
    // arsip. Yang diperiksa di sini hasil akhirnya, bukan ruas antaranya.
    const b = bahan359();
    const teks = susunPrompt(b, { ...pilihanAwal(b), arahPutusan: "kabul" });
    expect(teks).toContain("**E. DAFTAR LAMPIRAN FILE");
    for (const dokumen of [
      "SURAT GUGATAN (DocxRtf)__afdc3c67.docx",
      "Jawaban Termohon__29db9d4f.pdf",
      "BAS Pembuktian",
    ]) {
      expect(teks).toContain(dokumen);
    }
  });
});

describe("isianKurang", () => {
  it("menagih arah putusan dan blangko yang belum diisi", () => {
    const b = bahan359();
    const kurang = isianKurang(b, pilihanAwal(b));
    expect(kurang.some((k) => k.includes("Arah putusan"))).toBe(true);
    expect(kurang.some((k) => k.includes("blangko"))).toBe(true);
  });

  it("menagih isi kesepakatan pada mediasi berhasil yang isinya kosong", () => {
    // Justru keadaan perkara 359: hasilnya berhasil sebagian, tetapi yang
    // tersimpan di SIPP hanya ringkasan laporan, bukan pasal-pasalnya.
    const b = bahan359();
    b.mediasi.isiKesepakatan = "";
    const kurang = isianKurang(b, pilihanAwal(b));
    expect(kurang.some((k) => k.includes("kesepakatan mediasi kosong"))).toBe(true);
  });

  it("menyebut kode mediasi tidak baku agar penyusun tahu asal masalahnya", () => {
    const b = bahan359();
    b.mediasi.kodeHasil = "D";
    const kurang = isianKurang(b, pilihanAwal(b));
    expect(kurang.some((k) => k.includes('kode "D"'))).toBe(true);
  });

  it("diam ketika seluruh isian yang menentukan sudah terisi", () => {
    const b = bahan359();
    const kurang = isianKurang(b, {
      ...pilihanAwal(b),
      arahPutusan: "kabul",
      berkasBlangko: "359.rtf",
    });
    expect(kurang).toEqual([]);
  });
});
