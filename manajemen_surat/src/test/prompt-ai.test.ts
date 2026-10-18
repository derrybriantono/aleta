import { describe, expect, it } from "vitest";

import {
  PEMBUKA_AMAN,
  PROFIL_BAWAAN_V45,
  bersihkanProfilProject,
  labelVersiProfil,
  profilEfektif,
} from "@/lib/profil-project-ai";
import {
  TUJUAN_AI,
  inisialNama,
  isianKurangAi,
  keadaanPersidangan,
  masukanAwal,
  pemicuProject,
  INSTRUKSI_DATA_PRIBADI,
  CATATAN_HAPUS_DATA,
  samarkanContohFormat,
  samarkanTeks,
  susunPromptAi,
  tutupDataPribadi,
  type MasukanAi,
} from "@/lib/prompt-ai";
import { pilihanAwal, type BahanPrompt } from "@/lib/prompt-putusan";

/**
 * Bahan karangan - BUKAN perkara asli. Nama, NIK, dan nomornya rekaan.
 */
function bahanRekaan(): BahanPrompt {
  return {
    ok: true,
    identitas: {
      perkaraId: "1",
      nomorPerkara: "123/Pdt.G/2026/PA.Contoh",
      jenisPerkara: "Cerai Gugat",
      tanggalDaftar: "2026-09-02",
      gugatan: true,
    },
    pihak: {
      penggugat: [{ nama: "Aminah binti Salim", alamat: "Jl. Mawar No. 5, Kabupaten Donggala, Sulawesi Tengah" }],
      tergugat: [{ nama: "Hamid bin Yusuf", alamat: "Donggala" }],
    },
    kuasa: [{ nama: "Contoh Advokat", klien: "Aminah binti Salim", pihak: "Penggugat/Pemohon" }],
    sidang: [
      { tanggal: "2026-10-07", tanggalTerbaca: "7 Oktober 2026", agenda: "Sidang Pertama", alasanDitunda: "Mediasi", kehadiran: "kedua pihak hadir" },
      { tanggal: "2026-10-14", tanggalTerbaca: "14 Oktober 2026", agenda: "Jawaban Hamid", alasanDitunda: "Replik", kehadiran: "kedua pihak hadir" },
    ],
    mediasi: {
      ada: true,
      mediator: "Contoh Mediator, S.H.",
      tanggalMulai: "2026-10-07",
      tanggalMulaiTerbaca: "7 Oktober 2026",
      tanggalLaporan: "2026-10-21",
      tanggalLaporanTerbaca: "21 Oktober 2026",
      tanggalKesepakatan: "",
      tanggalKesepakatanTerbaca: "",
      kodeHasil: "T",
      hasilTerbaca: "tidak berhasil",
      isiKesepakatan: "",
      biaya: [],
    },
    saksi: [
      { nama: "Saksi Satu Rekaan", pihak: "Penggugat/Pemohon" },
      { nama: "Saksi Dua Rekaan", pihak: "Penggugat/Pemohon" },
    ],
    berkas: [
      {
        judul: "Jawaban Tergugat",
        jenis: "jawaban",
        diunggahOleh: "Tergugat",
        tanggalSidang: "2026-10-14",
        agenda: "Jawaban",
        adaPdf: true,
        adaWord: false,
        namaBerkasPdf: "",
        namaBerkasWord: "",
      },
    ],
    putusan: { tanggalPutusan: "", verstek: false, adaAmar: false },
  };
}

function masukan(ubah: Partial<MasukanAi> = {}): MasukanAi {
  return { ...masukanAwal(), ...ubah };
}

const bahan = bahanRekaan();
const pilihan = pilihanAwal(bahan);
const LARANGAN_ROLE = /Kamu adalah|Anda adalah|\bperan\b|\brole\b/i;

describe("perintah AI - tanpa centang Project", () => {
  const teks = susunPromptAi(bahan, pilihan, masukan({ tujuan: "pertimbangan", parameter: "nafkah iddah" }), profilEfektif(null));

  it("memuat bagian peran, tugas, data, format jawaban, dan batasan", () => {
    expect(teks).toMatch(/^PERAN\nAnda adalah/);
    expect(teks).toContain("TUGAS");
    expect(teks).toContain("DATA PERKARA");
    expect(teks).toContain("YANG DIMINTA");
    expect(teks).toContain("FORMAT JAWABAN");
    expect(teks).toContain("BATASAN");
  });

  it("memuat batasan dasar hukum dan hukum acara RBg tanpa HIR", () => {
    expect(teks).toMatch(/dasar hukum yang terverifikasi/);
    expect(teks).toMatch(/Jangan mengarang nomor putusan/);
    expect(teks).toMatch(/\[perlu verifikasi\]/);
    expect(teks).toMatch(/Hukum acara yang berlaku RBg \(bukan HIR\)/);
    expect(teks).not.toMatch(/HIR\/RBg|RBg\/HIR/);
    expect(teks).toMatch(/penetapan hari sidang ikrar talak/);
  });

  it("menyebut isu pada tugas", () => {
    expect(teks).toContain("nafkah iddah");
  });
});

describe("perintah AI - dengan centang Project", () => {
  const dengan = (m: Partial<MasukanAi>, profil = profilEfektif(null)) =>
    susunPromptAi(bahan, pilihan, masukan({ pakaiProject: true, ...m }), profil);

  it("tidak membuat peran, sapaan, atau kata role", () => {
    for (const t of TUJUAN_AI) {
      const teks = dengan({ tujuan: t.kunci, parameter: "isu contoh", pertanyaan: "Apa dasarnya?", keteranganSaksiBas: "Bahwa saksi kenal." });
      expect(teks, t.kunci).not.toMatch(LARANGAN_ROLE);
      expect(teks, t.kunci).not.toMatch(/PERAN|BATASAN|FORMAT JAWABAN/);
    }
  });

  it("membuka dengan kalimat singkat dan memakai pola data Project", () => {
    const teks = dengan({ tujuan: "ringkasan" });
    expect(teks.startsWith(PEMBUKA_AMAN)).toBe(true);
    const urut = ["JENIS:", "PENGGUGAT/PEMOHON:", "TERGUGAT/TERMOHON:", "SAKSI:", "YANG DIMINTA:"].map((k) => teks.indexOf(k));
    expect(urut.every((i) => i >= 0)).toBe(true);
    expect([...urut].sort((a, b) => a - b)).toEqual(urut);
  });

  it("memakai pemicu Project sesuai tujuan", () => {
    const harapan: [Partial<MasukanAi>, string][] = [
      [{ tujuan: "pertimbangan", parameter: "nafkah iddah" }, "YANG DIMINTA: PT nafkah iddah"],
      [{ tujuan: "putusan-lengkap" }, "YANG DIMINTA: PL"],
      [{ tujuan: "amar" }, "YANG DIMINTA: AM"],
      [{ tujuan: "blueprint", parameter: "putusan verstek" }, "YANG DIMINTA: BP putusan verstek"],
      [{ tujuan: "blueprint" }, "YANG DIMINTA: BP Cerai Gugat"],
      [{ tujuan: "analisa-sebelum" }, "YANG DIMINTA: AP SEBELUM"],
      [{ tujuan: "analisa-sesudah" }, "YANG DIMINTA: AP SESUDAH"],
      [{ tujuan: "pembuktian" }, "YANG DIMINTA: CEK BUKTI"],
      [{ tujuan: "komparasi" }, "YANG DIMINTA: KOMPARASI"],
      [{ tujuan: "ringkasan" }, "YANG DIMINTA: PERKARA"],
      [{ tujuan: "sidang", parameter: "pembuktian saksi" }, "YANG DIMINTA: SIDANG pembuktian saksi"],
      [{ tujuan: "saksi-bas", keteranganSaksiBas: "x" }, "YANG DIMINTA: KS DARI BAS"],
      [{ tujuan: "peta" }, "YANG DIMINTA: PETA"],
      [{ tujuan: "peta-ringkas" }, "YANG DIMINTA: PETA RINGKAS"],
      [{ tujuan: "faraidh" }, "YANG DIMINTA: KF"],
      [{ tujuan: "nafkah" }, "YANG DIMINTA: KN"],
      [{ tujuan: "biaya" }, "YANG DIMINTA: KB"],
      [{ tujuan: "cek-blangko" }, "YANG DIMINTA: CEK BLANGKO"],
      [{ tujuan: "papan" }, "YANG DIMINTA: PAPAN"],
    ];
    for (const [m, kalimat] of harapan) {
      expect(dengan(m), JSON.stringify(m)).toContain(kalimat);
    }
  });

  it("menambahkan meta saja/ringkas/selengkap mungkin pada pemicu", () => {
    expect(pemicuProject(masukan({ tujuan: "pertimbangan", parameter: "hadhanah", meta: "ringkas" }), bahan)).toBe("PT hadhanah ringkas");
    expect(pemicuProject(masukan({ tujuan: "amar", meta: "lengkap" }), bahan)).toBe("AM selengkap mungkin");
    expect(pemicuProject(masukan({ tujuan: "amar", meta: "saja" }), bahan)).toBe("AM saja");
  });

  it("memakai profil yang diisi Super Admin, dan tidak memuat ringkasan peran", () => {
    const profil = profilEfektif(
      bersihkanProfilProject({
        versi: "V.9 uji",
        tanggal: "2027-01-02",
        ringkasanRole: "RAHASIA-ROLE-JANGAN-MASUK",
        formatKeluaran: "Format uji satu",
        istilah: "Istilah uji dua",
        bagian: ["JENIS", "SAKSI", "YANG DIMINTA", "BUKTI SURAT"],
        pembuka: "Pembuka uji.",
        catatan: "",
      })
    );
    const teks = dengan({ tujuan: "ringkasan" }, profil);
    expect(teks.startsWith("Pembuka uji.")).toBe(true);
    expect(teks).toContain("Format keluaran: Format uji satu");
    expect(teks).toContain("Istilah dan aturan: Istilah uji dua");
    expect(teks).not.toContain("RAHASIA-ROLE-JANGAN-MASUK");
    // urutan bagian mengikuti profil: SAKSI sebelum yang lain yang tak disebut
    expect(teks.indexOf("JENIS:")).toBeLessThan(teks.indexOf("SAKSI:"));
    // yang tidak disebut profil tetap ikut - data tidak boleh hilang
    expect(teks).toContain("PENGGUGAT/PEMOHON:");
  });

  it("profil kosong memakai bawaan aman", () => {
    const kosong = profilEfektif(bersihkanProfilProject({ versi: "", pembuka: "", bagian: [] }));
    expect(kosong.pembuka).toBe(PEMBUKA_AMAN);
    expect(kosong.versi).toBe(PROFIL_BAWAAN_V45.versi);
    expect(dengan({ tujuan: "ringkasan" }, kosong).startsWith(PEMBUKA_AMAN)).toBe(true);
  });

  it("tidak menyebut HIR bersama RBg", () => {
    const teks = dengan({ tujuan: "putusan-lengkap" });
    expect(teks).not.toMatch(/HIR\/RBg|RBg\/HIR/);
  });

  it("menyertakan rincian putusan lengkap pada tujuan PL", () => {
    const teks = dengan({ tujuan: "putusan-lengkap" });
    expect(teks).toContain("RINCIAN PENYUSUNAN PUTUSAN");
    expect(teks).toContain("ARAH PUTUSAN");
  });
});

describe("pembungkus #VERBATIM", () => {
  const tempelan = {
    gugatan: "Bahwa Penggugat dan Tergugat menikah.   Dengan  typo  asli.",
    jawaban: "Bahwa Tergugat menolak seluruh dalil.",
    replik: "Replik apa adanya.",
    duplik: "",
    kesimpulan: "Kesimpulan apa adanya.",
  };

  it("membungkus tiap produk pihak apa adanya", () => {
    const teks = susunPromptAi(bahan, pilihan, masukan({ pakaiProject: true, tujuan: "pertimbangan", parameter: "x", tempelan }), profilEfektif(null));
    expect(teks).toContain("GUGATAN\n#VERBATIM\nBahwa Penggugat dan Tergugat menikah.   Dengan  typo  asli.\n#ENDVERBATIM");
    expect(teks).toContain("JAWABAN TERGUGAT\n#VERBATIM\nBahwa Tergugat menolak seluruh dalil.\n#ENDVERBATIM");
    expect(teks).toContain("REPLIK PENGGUGAT\n#VERBATIM");
    expect(teks).toContain("KESIMPULAN\n#VERBATIM");
    expect(teks).not.toContain("DUPLIK TERGUGAT");
    expect((teks.match(/#VERBATIM/g) ?? []).length).toBe((teks.match(/#ENDVERBATIM/g) ?? []).length);
  });

  it("memberi tanda kutipan BAS pada keterangan saksi", () => {
    const teks = susunPromptAi(bahan, pilihan, masukan({ pakaiProject: true, tujuan: "saksi-bas", keteranganSaksiBas: "Bahwa saksi kenal para pihak." }), profilEfektif(null));
    expect(teks).toContain("Keterangan saksi (kutipan BAS, apa adanya):\n#VERBATIM\nBahwa saksi kenal para pihak.\n#ENDVERBATIM");
  });
});

describe("penyamaran identitas", () => {
  const nik = "7203123456789012";
  const tempelan = {
    gugatan: `Penggugat Aminah binti Salim, NIK ${nik}, telepon 0812-3456-7890, tinggal di Donggala.`,
    jawaban: "Tergugat Hamid bin Yusuf membantah.",
    replik: "",
    duplik: "",
    kesimpulan: "",
  };

  for (const pakai of [false, true]) {
    it(`tidak membocorkan NIK, telepon, atau nama pihak (Project: ${pakai})`, () => {
      const teks = susunPromptAi(
        bahan,
        { ...pilihan, saksiManual: "Saksi Satu Rekaan membenarkan.", buktiSurat: `P.1 KTP-el atas nama Aminah binti Salim NIK ${nik}` },
        masukan({ pakaiProject: pakai, tujuan: "pembuktian", tempelan, fakta: "Hamid bin Yusuf pergi sejak 2025.", keteranganSaksiBas: "Saksi Dua Rekaan: Bahwa saya kenal Aminah." }),
        profilEfektif(null)
      );
      expect(teks).not.toMatch(/\d{16}/);
      expect(teks).not.toMatch(/0812/);
      expect(teks).not.toContain(nik);
      expect(teks).not.toMatch(/Aminah|Hamid|Salim|Yusuf|Contoh Advokat|Saksi Satu Rekaan|Saksi Dua Rekaan/);
      expect(teks).toContain("A. binti S.");
      expect(teks).toContain("H. bin Y.");
      expect(teks).toContain("[NIK disamarkan]");
    });
  }

  it("tujuan selain putusan: alamat hanya sampai kabupaten/kota", () => {
    for (const pakai of [false, true]) {
      for (const t of ["ringkasan", "analisa-sebelum", "cek-blangko"] as const) {
        const teks = susunPromptAi(bahan, pilihan, masukan({ pakaiProject: pakai, tujuan: t }), profilEfektif(null));
        expect(teks, `${t} ${pakai}`).not.toContain("Jl. Mawar");
        expect(teks, `${t} ${pakai}`).toContain("Kab. Donggala");
      }
    }
  });

  it("inisialNama dan tutupDataPribadi", () => {
    expect(inisialNama("Ewardin bin Lasan")).toBe("E. bin L.");
    expect(inisialNama("Siti Aminah binti Salim Ahmad")).toBe("S.A. binti S.A.");
    expect(inisialNama("Drs. H. Ahmad Yani, M.H.")).toBe("A.Y.");
    expect(tutupDataPribadi("NIK 7203 1234 5678 9012 dan 6281234567890")).not.toMatch(/\d{10}/);
    expect(samarkanTeks("Hamid bin Yusuf, Hamid", ["Hamid bin Yusuf"])).toBe("H. bin Y., H.");
  });
});

describe("tanpa kode teknis di perintah", () => {
  it("tidak memuat undefined, null, NaN, objek, atau kunci tujuan mentah", () => {
    for (const pakai of [false, true]) {
      for (const t of TUJUAN_AI) {
        const teks = susunPromptAi(bahan, pilihan, masukan({ pakaiProject: pakai, tujuan: t.kunci, parameter: "isu uji", pertanyaan: "Apa?", keteranganSaksiBas: "k" }), profilEfektif(null));
        expect(teks, `${t.kunci} ${pakai}`).not.toMatch(/undefined|\[object|\bNaN\b|\bnull\b/);
        expect(teks, `${t.kunci} ${pakai}`).not.toMatch(/analisa-sebelum|putusan-lengkap|peta-ringkas|cek-blangko|pakaiProject|keteranganSaksiBas/);
      }
    }
  });
});

describe("keadaan, kekurangan, dan versi profil", () => {
  it("membedakan kontradiktoir dan verstek", () => {
    expect(keadaanPersidangan(bahan)).toMatch(/Kontradiktoir/);
    const verstek = { ...bahan, putusan: { ...bahan.putusan, verstek: true } };
    expect(keadaanPersidangan(verstek)).toMatch(/Verstek/);
    const absen = { ...bahan, sidang: [{ ...bahan.sidang[0], kehadiran: "Tergugat/Termohon tidak hadir" }] };
    expect(keadaanPersidangan(absen)).toMatch(/tidak hadir pada 1 sidang/);
  });

  it("memperingatkan isian yang menentukan", () => {
    expect(isianKurangAi(masukan({ tujuan: "pertimbangan" }), bahan)).toContain("Isu yang dipertimbangkan belum diisi.");
    expect(isianKurangAi(masukan({ tujuan: "sidang" }), bahan)).toContain("Agenda sidang belum diisi.");
    expect(isianKurangAi(masukan({ tujuan: "tanya" }), bahan)).toContain("Pertanyaan belum ditulis.");
    expect(isianKurangAi(masukan({ tujuan: "ringkasan" }), bahan)).toEqual([]);
  });

  it("versi profil tampil kecil: V.4.5 dan tanggalnya", () => {
    expect(labelVersiProfil(profilEfektif(null))).toBe("Profil Project: PA Edition V.4.5 (Claude-Native Core) · 18 Okt 2026");
  });

  it("bersihkanProfilProject menolak yang bukan objek dan memangkas bagian", () => {
    expect(bersihkanProfilProject(null)).toBeNull();
    expect(bersihkanProfilProject("x")).toBeNull();
    const p = bersihkanProfilProject({ bagian: "A\nB\n\nC", tanggal: "bukan" });
    expect(p?.bagian).toEqual(["A", "B", "C"]);
    expect(p?.tanggal).toBe("");
  });
});

/* ---- keputusan 100: tujuan membuat putusan memakai nama asli ---- */
describe("tujuan membuat putusan: nama asli, NIK tertutup, instruksi hapus", () => {
  const nik = "7203123456789012";
  const TUJUAN_PUTUSAN = ["putusan-lengkap", "pertimbangan", "amar", "blueprint"] as const;
  const bahanNik: BahanPrompt = { ...bahan, kuasa: [{ nama: "Contoh Advokat", klien: "Aminah binti Salim", pihak: "Penggugat/Pemohon" }] };

  for (const pakai of [false, true]) {
    for (const t of TUJUAN_PUTUSAN) {
      it(`${t} (Project: ${pakai}) menulis alamat pihak LENGKAP, NIK/telepon pada alamat tetap tertutup`, () => {
        const bahanAlamat: BahanPrompt = {
          ...bahan,
          pihak: {
            penggugat: [{ nama: "Aminah binti Salim", alamat: `Jl. Mawar No. 5 RT 002 RW 003, Kab. Donggala, Sulawesi Tengah (NIK ${nik}, telp 0812-3456-7890)` }],
            tergugat: [{ nama: "Hamid bin Yusuf", alamat: "Dusun II Desa Labuan, Kec. Banawa, Kab. Donggala" }],
          },
        };
        const teks = susunPromptAi(bahanAlamat, pilihan, masukan({ pakaiProject: pakai, tujuan: t }), profilEfektif(null));
        expect(teks).toContain("Jl. Mawar No. 5 RT 002 RW 003, Kab. Donggala, Sulawesi Tengah");
        expect(teks).toContain("Dusun II Desa Labuan, Kec. Banawa, Kab. Donggala");
        expect(teks).not.toContain(nik);
        expect(teks).not.toMatch(/0812/);
        expect(teks).toContain(INSTRUKSI_DATA_PRIBADI);
      });

      it(`${t} (Project: ${pakai}) memuat nama asli, menutup NIK, dan menyertakan instruksi`, () => {
        const teks = susunPromptAi(
          bahanNik,
          { ...pilihan, arahPutusan: "kabul", buktiSurat: `P.1 KTP-el atas nama Aminah binti Salim NIK ${nik}` },
          masukan({ pakaiProject: pakai, tujuan: t, parameter: "nafkah iddah", fakta: "Telepon Hamid bin Yusuf 0812-3456-7890", tempelan: { gugatan: `Aminah binti Salim NIK ${nik}`, jawaban: "", replik: "", duplik: "", kesimpulan: "" } }),
          profilEfektif(null)
        );
        expect(teks).toContain("Aminah binti Salim");
        expect(teks).toContain("Hamid bin Yusuf");
        expect(teks).toContain("Contoh Advokat");
        expect(teks).toContain("Saksi Satu Rekaan");
        expect(teks).not.toMatch(/\d{16}/);
        expect(teks).not.toContain(nik);
        expect(teks).not.toMatch(/0812/);
        expect(teks).toContain("[placeholder: NIK]");
        expect(teks).toContain("[placeholder: telepon]");
        expect(teks).toContain(INSTRUKSI_DATA_PRIBADI);
        expect(teks).toMatch(/Jangan disimpan, diingat, atau dipakai untuk keperluan lain/);
        expect(teks).toMatch(/jangan mengulang data pribadi itu pada jawaban berikutnya/);
        expect(teks).toMatch(/anggap data pribadi tersebut telah dihapus/);
        if (pakai) expect(teks).not.toMatch(/Kamu adalah|Anda adalah|\bperan\b|\brole\b/i);
      });
    }
  }

  it("tujuan lain tetap disamarkan menjadi inisial dan tanpa instruksi hapus", () => {
    for (const t of ["pembuktian", "ringkasan", "analisa-sebelum", "komparasi", "sidang"] as const) {
      const teks = susunPromptAi(bahanNik, pilihan, masukan({ tujuan: t, parameter: "x", fakta: "Hamid bin Yusuf" }), profilEfektif(null));
      expect(teks, t).not.toMatch(/Aminah|Hamid|Contoh Advokat|Saksi Satu Rekaan/);
      expect(teks, t).toContain("H. bin Y.");
      expect(teks, t).not.toContain(INSTRUKSI_DATA_PRIBADI);
    }
  });

  it("catatan jujur di layar menyebut hanya bisa diminta", () => {
    expect(CATATAN_HAPUS_DATA).toBe("AI hanya bisa diminta; untuk menghapus data, hapus percakapan di aplikasi AI setelah selesai.");
  });
});

/* ---- saklar: ikuti format putusan tertentu ---- */
describe("saklar format putusan tertentu", () => {
  const contoh = [
    "PUTUSAN",
    "Nomor 77/Pdt.G/2026/PA.Lain",
    "Siti Rahmawati binti Ahmad, NIK 7271098765432101, Penggugat melawan Budi Santoso bin Karim, Tergugat",
    "MENGADILI",
    "1. Mengabulkan gugatan Penggugat;",
  ].join("\n");

  it("bawaan MATI: contoh tidak masuk perintah walau terisi", () => {
    expect(masukanAwal().ikutiFormat).toBe(false);
    const teks = susunPromptAi(bahan, pilihan, masukan({ tujuan: "putusan-lengkap", contohFormat: contoh }), profilEfektif(null));
    expect(teks).not.toContain("#CONTOH_FORMAT");
    expect(teks).not.toContain("Rahmawati");
  });

  it("menyala: contoh disamarkan otomatis, dibungkus, dengan instruksi tanpa menyalin fakta", () => {
    const teks = susunPromptAi(bahan, pilihan, masukan({ tujuan: "putusan-lengkap", ikutiFormat: true, contohFormat: contoh }), profilEfektif(null));
    expect(teks).toContain("CONTOH FORMAT PUTUSAN (format rujukan)");
    expect(teks).toMatch(/#CONTOH_FORMAT\n[\s\S]+\n#ENDCONTOH_FORMAT/);
    expect(teks).toMatch(/susunan bagian, judul, gaya kalimat, dan format amar/);
    expect(teks).toMatch(/Jangan menyalin fakta, nama, atau angka dari contoh/);
    expect(teks).not.toMatch(/Rahmawati|Santoso|7271098765432101/);
    expect(teks).toContain("S.R. binti A.");
    expect(teks).toContain("B.S. bin K.");
    expect(teks).toContain("MENGADILI");
    // fakta contoh tidak dipindah ke bagian data perkara
    const dataPerkara = teks.slice(0, teks.indexOf("#CONTOH_FORMAT"));
    expect(dataPerkara).not.toContain("77/Pdt.G/2026/PA.Lain");
  });

  it("dengan Project: disebut format rujukan saja, tanpa role", () => {
    const teks = susunPromptAi(bahan, pilihan, masukan({ pakaiProject: true, tujuan: "putusan-lengkap", ikutiFormat: true, contohFormat: contoh }), profilEfektif(null));
    expect(teks).toContain("FORMAT RUJUKAN");
    expect(teks).toMatch(/hanya format rujukan/);
    expect(teks).toMatch(/Gaya rumah Project tetap berlaku/);
    expect(teks).not.toMatch(/Kamu adalah|Anda adalah|\bperan\b|\brole\b/i);
  });

  it("tidak berlaku untuk tujuan yang bukan membuat putusan", () => {
    const teks = susunPromptAi(bahan, pilihan, masukan({ tujuan: "ringkasan", ikutiFormat: true, contohFormat: contoh }), profilEfektif(null));
    expect(teks).not.toContain("#CONTOH_FORMAT");
  });

  it("samarkanContohFormat tidak memakan kata penyebut peran", () => {
    expect(samarkanContohFormat("Penggugat Aminah binti Salim hadir")).toBe("Penggugat A. binti S. hadir");
  });
});

/* ---- saklar: sertakan putusan yang masih berbentuk blangko ---- */
describe("saklar putusan yang masih berbentuk blangko", () => {
  const draf = [
    {
      sumber: "Berkas putusan hasil ABT",
      judul: "putusan-123.rtf",
      teks: "Bahwa menikah pada tanggal [KOSONG-1: titik-titik] di [KOSONG-2: kurung siku «[KUA]»]",
      rekap: "Ditemukan 2 bagian kosong (titik-titik 1, kurung siku 1).\n- KOSONG-1 (titik-titik): …menikah pada tanggal [ISI] di…",
    },
  ];

  it("bawaan NYALA dan draf disertakan beserta tugas dan rekap", () => {
    expect(masukanAwal().sertakanBlangko).toBe(true);
    for (const pakai of [false, true]) {
      const teks = susunPromptAi(bahan, pilihan, masukan({ pakaiProject: pakai, tujuan: "putusan-lengkap" }), profilEfektif(null), { drafBlangko: draf });
      expect(teks).toContain("#DRAF_BLANGKO");
      expect(teks).toContain("[KOSONG-1: titik-titik]");
      expect(teks).toContain("REKAP KEKOSONGAN");
      expect(teks).toContain("Ditemukan 2 bagian kosong");
      expect(teks).toMatch(/HANYA dari data perkara yang disertakan/);
      expect(teks).toMatch(/biarkan \[placeholder: nama data\]/);
      expect(teks).toMatch(/kecuali yang jelas keliru; tiap perubahan semacam itu tandai \[DIUBAH/);
      expect(teks).toMatch(/naskah utuh yang sudah dilengkapi, lalu daftar isian yang diisi beserta sumbernya, lalu daftar yang masih kosong/);
      if (pakai) expect(teks).not.toMatch(/Kamu adalah|Anda adalah|\bperan\b|\brole\b/i);
    }
  });

  it("dengan Project: pemicu CEK BLANGKO lalu PL", () => {
    const teks = susunPromptAi(bahan, pilihan, masukan({ pakaiProject: true, tujuan: "putusan-lengkap" }), profilEfektif(null), { drafBlangko: draf });
    expect(teks).toContain("YANG DIMINTA: CEK BLANGKO lalu PL");
  });

  it("saklar MATI: draf tidak disertakan", () => {
    const teks = susunPromptAi(bahan, pilihan, masukan({ tujuan: "putusan-lengkap", sertakanBlangko: false }), profilEfektif(null), { drafBlangko: draf });
    expect(teks).not.toContain("#DRAF_BLANGKO");
    expect(teks).not.toContain("KOSONG-1");
  });

  it("tanpa draf: tidak ada bagian draf", () => {
    expect(susunPromptAi(bahan, pilihan, masukan({ tujuan: "putusan-lengkap" }), profilEfektif(null))).not.toContain("#DRAF_BLANGKO");
  });

  it("NIK pada draf tetap tertutup dan nama asli dipakai pada tujuan putusan", () => {
    const d = [{ ...draf[0], teks: "Aminah binti Salim NIK 7203123456789012 [KOSONG-1: titik-titik]" }];
    const teks = susunPromptAi(bahan, pilihan, masukan({ tujuan: "amar" }), profilEfektif(null), { drafBlangko: d });
    expect(teks).toContain("Aminah binti Salim");
    expect(teks).not.toMatch(/\d{16}/);
  });
});
