// @vitest-environment node
import { describe, expect, it } from "vitest";

import { BATAS_BAWAAN, batasRuas, saringKeluar } from "@/lib/batas-data";
import {
  kompetensiTerpenuhi,
  periksaPerkara,
  urutkanHasil,
  type AturanPemeriksaan,
} from "@/lib/pemeriksaan-perkara";
import { buatPenyamar } from "@/lib/penyamaran";
import { namaDisebut, periksaDaluwarsa, susunPeta } from "@/lib/peta-dalil";
import { cariSerupa, susunSidik } from "@/lib/perkara-serupa";
import {
  periksaPanggilan,
  periksaVerstek,
  selisihHariKalender,
  selisihHariKerja,
  type TenggangJalur,
} from "@/lib/tenggang-panggilan";

/**
 * Analisis perkara (G1-G5) dan penjagaan (J5, J6).
 *
 * ============================================================================
 * CONTOH DI SINI MENIRUKAN BENTUK, BUKAN MENYATAKAN HUKUM
 * ============================================================================
 *
 * Jangkar, tenggang hari, dan daftar jenis perkara di bawah adalah karangan
 * yang bentuknya menyerupai yang sebenarnya. Tidak satu pun boleh dibaca
 * sebagai aturan yang berlaku - justru itulah yang diuji: mesin ini tidak
 * boleh menyimpulkan apa pun dari aturan yang dasarnya tidak ada.
 *
 * ============================================================================
 * YANG DIJAGA
 * ============================================================================
 *
 *   - aturan yang jangkarnya tidak ada TIDAK menyatakan lolos;
 *   - fakta yang belum tercatat TIDAK dibaca sebagai "tidak";
 *   - panggilan yang belum dapat diperiksa TIDAK meloloskan verstek; dan
 *   - ruas yang belum punya aturan batas TIDAK ikut keluar.
 */

// ── G1 & G2 mesin pemeriksaan ──────────────────────────────────────────────

const JANGKAR_ADA = new Set(["uu-7-1989/pasal-49", "uu-7-1989/pasal-73"]);

function aturan(lebih: Partial<AturanPemeriksaan> = {}): AturanPemeriksaan {
  return {
    kode: "G1-absolut",
    kelompok: "kompetensi",
    hal: "Kewenangan absolut",
    jenis: "nilaiSama",
    fakta: "agamaPenggugat",
    pembanding: "Islam",
    tingkat: "halangan",
    tindakan: "Periksa kembali kewenangan pengadilan atas perkara ini.",
    jangkar: "uu-7-1989/pasal-49",
    ...lebih,
  };
}

describe("aturan tanpa dasar hukum tidak memutuskan apa pun", () => {
  it("jangkar yang TIDAK ada di pustaka menghasilkan dasarBelumAda, bukan lolos", () => {
    // Pemeriksaan yang menyatakan "kompetensi terpenuhi" berdasarkan aturan
    // yang dasarnya tidak pernah dimasukkan siapa pun adalah pernyataan hukum
    // tanpa hukum - dan ia terbaca sama meyakinkannya dengan yang benar.
    const hasil = periksaPerkara(
      [aturan({ jangkar: "uu-99-2099/pasal-1" })],
      { agamaPenggugat: "Islam" },
      JANGKAR_ADA
    );
    expect(hasil.hasil[0].keadaan).toBe("dasarBelumAda");
    expect(hasil.dasarBelumAda).toHaveLength(1);
  });

  it("aturan tanpa jangkar sama sekali juga tidak memutuskan", () => {
    const hasil = periksaPerkara([aturan({ jangkar: "" })], { agamaPenggugat: "Islam" }, JANGKAR_ADA);
    expect(hasil.hasil[0].keadaan).toBe("dasarBelumAda");
    expect(hasil.hasil[0].keterangan).toContain("tidak menyebut dasar hukumnya");
  });

  it("dasar hukum diperiksa LEBIH DULU daripada faktanya", () => {
    // Kekurangan yang dituntut aturan tak berdasar bukan kekurangan.
    const hasil = periksaPerkara([aturan({ jangkar: "tidak-ada" })], {}, JANGKAR_ADA);
    expect(hasil.hasil[0].keadaan).toBe("dasarBelumAda");
    expect(hasil.faktaKurang).toEqual([]);
  });
});

describe("fakta yang belum tercatat", () => {
  it("TIDAK dibaca sebagai tidak, dan tidak pula sebagai ya", () => {
    const hasil = periksaPerkara([aturan()], {}, JANGKAR_ADA);
    expect(hasil.hasil[0].keadaan).toBe("belumDapatDiperiksa");
    expect(hasil.halangan).toEqual([]);
    expect(hasil.faktaKurang).toEqual(["agamaPenggugat"]);
  });

  it("teks kosong dihitung belum tercatat", () => {
    const hasil = periksaPerkara([aturan()], { agamaPenggugat: "   " }, JANGKAR_ADA);
    expect(hasil.hasil[0].keadaan).toBe("belumDapatDiperiksa");
  });

  it("fakta yang ada dan sesuai menghasilkan terpenuhi", () => {
    const hasil = periksaPerkara([aturan()], { agamaPenggugat: "islam" }, JANGKAR_ADA);
    expect(hasil.hasil[0].keadaan).toBe("terpenuhi");
  });

  it("fakta yang ada dan berbeda menghasilkan halangan", () => {
    const hasil = periksaPerkara([aturan()], { agamaPenggugat: "Kristen" }, JANGKAR_ADA);
    expect(hasil.hasil[0].keadaan).toBe("tidakTerpenuhi");
    expect(hasil.halangan).toHaveLength(1);
  });
});

describe("jenis pemeriksaan", () => {
  it("nilaiSalahSatu menerima yang termasuk daftar", () => {
    const pola = aturan({ jenis: "nilaiSalahSatu", fakta: "jenisPerkara", pembanding: ["Cerai Gugat", "Cerai Talak"] });
    expect(periksaPerkara([pola], { jenisPerkara: "cerai talak" }, JANGKAR_ADA).hasil[0].keadaan).toBe("terpenuhi");
    expect(periksaPerkara([pola], { jenisPerkara: "Waris" }, JANGKAR_ADA).hasil[0].keadaan).toBe("tidakTerpenuhi");
  });

  it("minimal membandingkan sebagai angka", () => {
    const pola = aturan({ jenis: "minimal", fakta: "jumlahSaksi", pembanding: 2 });
    expect(periksaPerkara([pola], { jumlahSaksi: 2 }, JANGKAR_ADA).hasil[0].keadaan).toBe("terpenuhi");
    expect(periksaPerkara([pola], { jumlahSaksi: 1 }, JANGKAR_ADA).hasil[0].keadaan).toBe("tidakTerpenuhi");
  });

  it("tidakBoleh menolak yang dilarang", () => {
    const pola = aturan({ jenis: "tidakBoleh", fakta: "keadaanPerkara", pembanding: "dicabut" });
    expect(periksaPerkara([pola], { keadaanPerkara: "dicabut" }, JANGKAR_ADA).hasil[0].keadaan).toBe("tidakTerpenuhi");
    expect(periksaPerkara([pola], { keadaanPerkara: "berjalan" }, JANGKAR_ADA).hasil[0].keadaan).toBe("terpenuhi");
  });

  it("wajibAda cukup dengan isinya apa pun", () => {
    const pola = aturan({ jenis: "wajibAda", fakta: "suratKuasa" });
    expect(periksaPerkara([pola], { suratKuasa: "ada" }, JANGKAR_ADA).hasil[0].keadaan).toBe("terpenuhi");
  });
});

describe("kompetensi diperiksa lebih dulu", () => {
  it("tanpa satu pun aturan kompetensi, perkara TIDAK boleh diperiksa", () => {
    // Bawaan "boleh" di sini berarti tiap pengadilan yang belum memasukkan
    // aturan kompetensinya memeriksa segala perkara.
    const hasil = periksaPerkara([aturan({ kelompok: "formil" })], { agamaPenggugat: "Islam" }, JANGKAR_ADA);
    expect(kompetensiTerpenuhi(hasil).boleh).toBe(false);
    expect(kompetensiTerpenuhi(hasil).sebab).toContain("Tidak ada satu pun aturan kompetensi");
  });

  it("kompetensi yang belum dapat diperiksa juga menahan", () => {
    const hasil = periksaPerkara([aturan()], {}, JANGKAR_ADA);
    expect(kompetensiTerpenuhi(hasil).boleh).toBe(false);
  });

  it("kompetensi terpenuhi membuka pemeriksaan berikutnya", () => {
    const hasil = periksaPerkara([aturan()], { agamaPenggugat: "Islam" }, JANGKAR_ADA);
    expect(kompetensiTerpenuhi(hasil).boleh).toBe(true);
  });

  it("hasilnya diurutkan kompetensi lebih dulu, lalu yang terberat", () => {
    const hasil = periksaPerkara(
      [
        aturan({ kode: "G2-b", kelompok: "formil", tingkat: "catatan", fakta: "a" }),
        aturan({ kode: "G2-a", kelompok: "formil", tingkat: "halangan", fakta: "b" }),
        aturan({ kode: "G1-a", kelompok: "kompetensi", fakta: "c" }),
      ],
      { a: "x", b: "y", c: "z" },
      JANGKAR_ADA
    );
    expect(urutkanHasil(hasil.hasil).map((item) => item.kode)).toEqual(["G1-a", "G2-a", "G2-b"]);
  });
});

// ── G2 tenggang panggilan ──────────────────────────────────────────────────

const TENGGANG: TenggangJalur[] = [
  { jalur: "biasa", hari: 3, hariKerja: true, perluDiterima: false, jangkar: "uu-7-1989/pasal-26" },
  { jalur: "elektronik", hari: 3, hariKerja: true, perluDiterima: true, jangkar: "perma-1-2019/pasal-15" },
];

describe("selisih hari", () => {
  it("hari kalender dihitung apa adanya", () => {
    expect(selisihHariKalender("2026-04-01", "2026-04-08")).toBe(7);
  });

  it("hari kerja melewati Sabtu dan Minggu", () => {
    // 2026-04-01 Rabu, 2026-04-08 Rabu berikutnya: 5 hari kerja.
    expect(selisihHariKerja("2026-04-01", "2026-04-08")).toBe(5);
  });

  it("hari libur dikecualikan hanya bila daftarnya diberikan", () => {
    // Menebaknya akan menghasilkan tenggang yang salah setiap tahun, karena
    // tanggalnya berpindah.
    expect(selisihHariKerja("2026-04-01", "2026-04-08", [])).toBe(5);
    expect(selisihHariKerja("2026-04-01", "2026-04-08", ["2026-04-03"])).toBe(4);
  });

  it("tanggal yang tidak terbaca menghasilkan null, bukan nol", () => {
    expect(selisihHariKerja("", "2026-04-08")).toBeNull();
    expect(selisihHariKalender("2026-04-01", "")).toBeNull();
  });
});

describe("kepatutan panggilan", () => {
  it("terpaut cukup lama dinyatakan patut", () => {
    const hasil = periksaPanggilan(
      { pihak: "Tergugat", tanggalPanggilan: "2026-04-01", tanggalSidang: "2026-04-08" },
      TENGGANG
    );
    expect(hasil.keadaan).toBe("patut");
    expect(hasil.satuan).toBe("hari kerja");
  });

  it("terpaut kurang dinyatakan tidak patut, dengan angkanya", () => {
    const hasil = periksaPanggilan(
      { pihak: "Tergugat", tanggalPanggilan: "2026-04-06", tanggalSidang: "2026-04-08" },
      TENGGANG
    );
    expect(hasil.keadaan).toBe("tidakPatut");
    expect(hasil.keterangan).toContain("sekurangnya 3");
  });

  it("panggilan SESUDAH sidang tidak dibaca sebagai angka kecil", () => {
    // Selisih negatif yang dibandingkan besarnya saja akan lolos.
    const hasil = periksaPanggilan(
      { pihak: "Tergugat", tanggalPanggilan: "2026-04-10", tanggalSidang: "2026-04-08" },
      TENGGANG
    );
    expect(hasil.keadaan).toBe("tidakPatut");
    expect(hasil.keterangan).toContain("SESUDAH hari sidang");
  });

  it("tenggang yang belum disetel TIDAK memakai angka bawaan", () => {
    // Angka bawaan pada pemeriksaan hukum benar pada kebanyakan perkara, dan
    // pada perkara yang jalurnya berbeda ia meloloskan panggilan tidak sah.
    const hasil = periksaPanggilan(
      { pihak: "Tergugat", tanggalPanggilan: "2026-04-01", tanggalSidang: "2026-04-08", jalur: "kurir" },
      TENGGANG
    );
    expect(hasil.keadaan).toBe("belumDapatDiperiksa");
    expect(hasil.keterangan).toContain("belum disetel");
  });

  it("jalur yang menuntut penerimaan tidak lolos tanpa buktinya", () => {
    const belum = periksaPanggilan(
      { pihak: "Tergugat", tanggalPanggilan: "2026-04-01", tanggalSidang: "2026-04-08", jalur: "elektronik" },
      TENGGANG
    );
    expect(belum.keadaan).toBe("belumDapatDiperiksa");

    const tolak = periksaPanggilan(
      {
        pihak: "Tergugat",
        tanggalPanggilan: "2026-04-01",
        tanggalSidang: "2026-04-08",
        jalur: "elektronik",
        diterima: false,
      },
      TENGGANG
    );
    expect(tolak.keadaan).toBe("tidakPatut");
  });
});

describe("kelayakan verstek", () => {
  const patut = periksaPanggilan(
    { pihak: "Tergugat", tanggalPanggilan: "2026-04-01", tanggalSidang: "2026-04-08" },
    TENGGANG
  );
  const kurang = periksaPanggilan(
    { pihak: "Tergugat", tanggalPanggilan: "2026-04-06", tanggalSidang: "2026-04-08" },
    TENGGANG
  );
  const belum = periksaPanggilan(
    { pihak: "Tergugat", tanggalPanggilan: "", tanggalSidang: "2026-04-08" },
    TENGGANG
  );

  it("tergugat tidak hadir dan dipanggil patut, tanpa alasan sah: layak", () => {
    const hasil = periksaVerstek({ tergugatHadir: false, panggilan: [patut], alasanTidakHadir: "" });
    expect(hasil.layak).toBe(true);
  });

  it("ketidakhadiran saja TIDAK cukup - panggilan tidak patut membatalkannya", () => {
    // Verstek atas panggilan yang tidak sah dibatalkan di tingkat banding, dan
    // perkaranya diulang dari awal.
    const hasil = periksaVerstek({ tergugatHadir: false, panggilan: [kurang], alasanTidakHadir: "" });
    expect(hasil.layak).toBe(false);
    expect(hasil.keadaan).toBe("tidakLayak");
  });

  it("panggilan yang BELUM dapat diperiksa tidak dibaca sebagai patut", () => {
    const hasil = periksaVerstek({ tergugatHadir: false, panggilan: [belum], alasanTidakHadir: "" });
    expect(hasil.layak).toBe(false);
    expect(hasil.keadaan).toBe("belumDapatDiperiksa");
  });

  it("alasan sah yang tercatat membatalkan verstek", () => {
    const hasil = periksaVerstek({ tergugatHadir: false, panggilan: [patut], alasanTidakHadir: "sedang dirawat" });
    expect(hasil.keadaan).toBe("tidakLayak");
  });

  it("belum tercatat ada tidaknya alasan bukan berarti tidak ada alasan", () => {
    const hasil = periksaVerstek({ tergugatHadir: false, panggilan: [patut] });
    expect(hasil.keadaan).toBe("belumDapatDiperiksa");
  });

  it("tanpa relaas Tergugat sama sekali, verstek tidak dapat dinilai", () => {
    const hasil = periksaVerstek({ tergugatHadir: false, panggilan: [], alasanTidakHadir: "" });
    expect(hasil.keadaan).toBe("belumDapatDiperiksa");
  });

  it("tergugat hadir membuat verstek tidak berlaku", () => {
    expect(periksaVerstek({ tergugatHadir: true, panggilan: [patut] }).keadaan).toBe("tidakLayak");
  });
});

// ── G3 & G4 peta dalil ─────────────────────────────────────────────────────

const PETA = {
  petitum: [
    { nomor: 1, teks: "Mengabulkan gugatan Penggugat seluruhnya;", dalilKe: [1] },
    { nomor: 2, teks: "Menjatuhkan talak satu bain sughra;", dalilKe: [2] },
    { nomor: 3, teks: "Menetapkan hak asuh anak kepada Penggugat;" },
    { nomor: 4, teks: "Mohon putusan yang seadil-adilnya;" },
  ],
  dalil: [
    { nomor: 1, teks: "Bahwa Penggugat dan Tergugat menikah pada tahun 2015;", buktiKe: [1] },
    { nomor: 2, teks: "Bahwa sejak 2024 terjadi perselisihan terus-menerus;", buktiKe: [] },
  ],
  bukti: [
    { nomor: 1, kode: "P-1", teks: "Fotokopi buku nikah" },
    { nomor: 2, kode: "P-2", teks: "Fotokopi kartu keluarga" },
  ],
  pihak: ["Reka Febrianti binti Rajab", "Andi Saputra bin Yusuf"],
};

describe("peta dalil, bukti, dan petitum", () => {
  it("petitum tanpa dalil terlihat", () => {
    const peta = susunPeta(PETA);
    expect(peta.petitumTanpaDalil.map((item) => item.nomor)).toEqual([3]);
  });

  it("dalil tanpa bukti terlihat", () => {
    expect(susunPeta(PETA).dalilTanpaBukti.map((item) => item.nomor)).toEqual([2]);
  });

  it("bukti yang tidak dipakai satu pun dalil terlihat", () => {
    expect(susunPeta(PETA).buktiTakTerpakai.map((item) => item.kode)).toEqual(["P-2"]);
  });

  it("petitum subsidair tidak dihitung kurang", () => {
    expect(susunPeta(PETA).petitumTanpaDalil.map((item) => item.nomor)).not.toContain(4);
  });

  it("usulan tautan TIDAK mengurangi daftar kekurangan", () => {
    // Peta yang tampak lengkap karena tebakan lebih berbahaya daripada tidak
    // ada peta: yang membacanya menyimpulkan pembuktiannya sudah tuntas.
    const dengan = susunPeta({
      ...PETA,
      dalil: [...PETA.dalil, { nomor: 3, teks: "Bahwa hak asuh anak seharusnya kepada Penggugat;", buktiKe: [2] }],
    });
    expect(dengan.usulan.some((item) => item.petitumKe === 3)).toBe(true);
    expect(dengan.petitumTanpaDalil.map((item) => item.nomor)).toEqual([3]);
  });

  it("usulan hanya untuk petitum yang BELUM tertaut", () => {
    // Mengusulkan tautan bagi petitum yang sudah ditegaskan hakim berarti
    // menawarkan mesin sebagai pembanding penilaian hakim.
    expect(susunPeta(PETA).usulan.every((item) => item.petitumKe === 3)).toBe(true);
  });
});

describe("deteksi risiko", () => {
  it("petitum yang menyebut orang bukan pihak menghasilkan risiko kurang pihak", () => {
    const peta = susunPeta({
      ...PETA,
      petitum: [...PETA.petitum, { nomor: 5, teks: "Menghukum Hasan Basri menyerahkan sertifikat;", dalilKe: [1] }],
    });
    const kurang = peta.risiko.filter((item) => item.jenis === "kurangPihak");
    expect(kurang).toHaveLength(1);
    expect(kurang[0].keterangan).toContain("Hasan Basri");
  });

  it("nama yang memang pihak TIDAK dianggap kurang pihak", () => {
    const peta = susunPeta({
      ...PETA,
      petitum: [
        ...PETA.petitum,
        { nomor: 5, teks: "Menghukum Andi Saputra menyerahkan sertifikat;", dalilKe: [1] },
      ],
    });
    expect(peta.risiko.filter((item) => item.jenis === "kurangPihak")).toHaveLength(0);
  });

  it("sebutan peran bukan nama orang", () => {
    expect(namaDisebut("Menghukum Tergugat membayar biaya")).not.toContain("Tergugat");
  });

  it("daluwarsa TIDAK dihitung tanpa tenggang dan jangkarnya", () => {
    // Daluwarsa dari angka tebakan menyatakan perkara lewat waktu padahal
    // tidak, dan pernyataan itu terbaca seyakin yang benar.
    expect(
      periksaDaluwarsa({
        tanggalPeristiwa: "2020-01-01",
        tanggalDaftar: "2026-03-02",
        tenggangHari: null,
        jangkar: "uu-7-1989/pasal-73",
      })
    ).toBeNull();
    expect(
      periksaDaluwarsa({
        tanggalPeristiwa: "2020-01-01",
        tanggalDaftar: "2026-03-02",
        tenggangHari: 180,
        jangkar: "",
      })
    ).toBeNull();
  });

  it("daluwarsa dihitung bila tenggang dan jangkarnya lengkap", () => {
    const risiko = periksaDaluwarsa({
      tanggalPeristiwa: "2020-01-01",
      tanggalDaftar: "2026-03-02",
      tenggangHari: 180,
      jangkar: "uu-7-1989/pasal-73",
    });
    expect(risiko?.jenis).toBe("daluwarsa");
    expect(risiko?.keterangan).toContain("uu-7-1989/pasal-73");
  });
});

// ── G5 perkara serupa ──────────────────────────────────────────────────────

describe("perkara serupa", () => {
  const fakta = { jenisPerkara: "Cerai Gugat", tergugatHadir: false, jumlahSaksi: 2, adaAnak: true };

  it("nama, tanggal, dan nomor TIDAK masuk sidik", () => {
    // Fakta yang unik membuat tiap perkara serupa hanya dengan dirinya
    // sendiri, dan pencariannya selalu mengembalikan kosong.
    const sidik = susunSidik("1", "545/Pdt.G/2026/PA.Dgl", {
      ...fakta,
      namaPenggugat: "Reka Febrianti",
      tanggalDaftar: "2026-03-02",
      nomorPerkara: "545/Pdt.G/2026/PA.Dgl",
      nik: "7201234567890123",
      alamatPenggugat: "Donggala",
    });
    expect(sidik.sidik).not.toContain("Reka");
    expect(sidik.sidik).not.toContain("2026-03-02");
    expect(sidik.butir).toHaveLength(4);
  });

  it("fakta kosong tidak menjadi butir", () => {
    // Butir "alasan=" pada dua perkara yang sama-sama belum mengisi alasannya
    // akan terhitung sebagai kesamaan - padahal yang sama hanya kekosongannya.
    const sidik = susunSidik("1", "x", { ...fakta, alasan: "" });
    expect(sidik.butir.some((butir) => butir.startsWith("alasan="))).toBe(false);
  });

  it("perkara dengan pola sama ditemukan, beserta sebab kemiripannya", () => {
    const acuan = susunSidik("1", "545/Pdt.G/2026/PA.Dgl", fakta);
    const pustaka = [
      susunSidik("2", "120/Pdt.G/2025/PA.Dgl", fakta),
      susunSidik("3", "300/Pdt.G/2025/PA.Dgl", { ...fakta, tergugatHadir: true, adaAnak: false }),
    ];
    const hasil = cariSerupa(acuan, pustaka);
    expect(hasil[0].perkaraId).toBe("2");
    expect(hasil[0].skor).toBe(1);
    expect(hasil[0].sama.length).toBeGreaterThan(0);
    expect(hasil.map((item) => item.perkaraId)).not.toContain("3");
  });

  it("perkara itu sendiri tidak muncul di hasilnya", () => {
    const acuan = susunSidik("1", "545/Pdt.G/2026/PA.Dgl", fakta);
    expect(cariSerupa(acuan, [acuan])).toEqual([]);
  });

  it("urutannya ajeg, sehingga daftarnya dapat dijadikan rujukan", () => {
    const acuan = susunSidik("1", "545/Pdt.G/2026/PA.Dgl", fakta);
    const a = susunSidik("2", "120/Pdt.G/2025/PA.Dgl", fakta);
    const b = susunSidik("3", "121/Pdt.G/2025/PA.Dgl", fakta);
    expect(cariSerupa(acuan, [a, b]).map((i) => i.nomorPerkara)).toEqual(
      cariSerupa(acuan, [b, a]).map((i) => i.nomorPerkara)
    );
  });
});

// ── J5 batas data ──────────────────────────────────────────────────────────

describe("batas data", () => {
  it("ruas yang belum punya aturan diperlakukan TERLARANG", () => {
    // Bawaan "boleh" berarti tiap ruas baru diam-diam ikut terkirim sampai ada
    // yang menyadarinya. Kiriman yang lolos tidak dapat ditarik kembali.
    const putusan = batasRuas("kolomBaruYangBelumDikenal");
    expect(putusan.batas).toBe("terlarang");
    expect(putusan.bawaanKetat).toBe(true);
  });

  it("NIK dan alamat tidak pernah keluar", () => {
    expect(batasRuas("nik").batas).toBe("terlarang");
    expect(batasRuas("alamatPenggugat").batas).toBe("terlarang");
  });

  it("aturan yang lebih tepat mengalahkan yang berpola", () => {
    const aturan = [...BATAS_BAWAAN, { ruas: "namaHakim", batas: "bebas" as const, sebab: "Nama hakim terbuka." }];
    expect(batasRuas("namaHakim", aturan).batas).toBe("bebas");
    expect(batasRuas("namaSaksi", aturan).batas).toBe("samar");
  });

  it("ruas samar hanya lolos bila penyamarnya benar-benar mengubahnya", () => {
    // Penyamar yang mengembalikan nilai apa adanya akan meloloskan data asli
    // lewat pintu bernama "sudah disamarkan".
    const hasil = saringKeluar({ namaPenggugat: "Reka Febrianti" }, (nilai) => nilai);
    expect(hasil.dikirim.namaPenggugat).toBeUndefined();
    expect(hasil.ditahan[0].sebab).toContain("tidak mengubah nilainya");
  });

  it("ruas bebas keluar apa adanya, terlarang ditahan, samar disamarkan", () => {
    const penyamar = buatPenyamar("garam-uji");
    const hasil = saringKeluar(
      {
        jenisPerkara: "Cerai Gugat",
        nik: "7201234567890123",
        namaPenggugat: "Reka Febrianti",
      },
      penyamar.samarkanNilai
    );
    expect(hasil.dikirim.jenisPerkara).toBe("Cerai Gugat");
    expect(hasil.dikirim.nik).toBeUndefined();
    expect(hasil.dikirim.namaPenggugat).toBe("Orang A");
    expect(hasil.ditahan.map((item) => item.ruas)).toEqual(["nik"]);
  });

  it("ruas tanpa aturan dilaporkan supaya diputuskan", () => {
    const hasil = saringKeluar({ ruasAsing: "isi" }, (nilai) => nilai);
    expect(hasil.belumBeraturan).toEqual(["ruasAsing"]);
  });
});

// ── J6 penyamaran ──────────────────────────────────────────────────────────

describe("penyamaran", () => {
  it("satu orang mendapat satu sebutan tetap di seluruh berkas", () => {
    // Mengganti tiap nama dengan "XXX" membuat naskahnya tidak dapat dipakai
    // menguji apa pun: yang membacanya kehilangan siapa mengatakan apa.
    const penyamar = buatPenyamar("garam-uji");
    const hasil = penyamar.samarkanTeks(
      "Reka Febrianti menerangkan bahwa Andi Saputra pergi. Reka Febrianti menambahkan keterangannya."
    );
    const sebutan = hasil.teks.match(/Orang [A-Z]/g) ?? [];
    expect(sebutan[0]).toBe(sebutan[2]);
    expect(sebutan[0]).not.toBe(sebutan[1]);
  });

  it("sebutan peran dan nama lembaga tidak ikut disamarkan", () => {
    const penyamar = buatPenyamar("garam-uji");
    const hasil = penyamar.samarkanTeks("Pengadilan Agama Donggala memanggil Tergugat pada Berita Acara.");
    expect(hasil.teks).toContain("Tergugat");
    expect(hasil.teks).toContain("Pengadilan Agama");
  });

  it("NIK, telepon, surel, dan nomor perkara diganti", () => {
    const penyamar = buatPenyamar("garam-uji");
    const hasil = penyamar.samarkanTeks(
      "NIK 7201234567890123, telepon 081234567890, surel a.b@contoh.id, perkara 545/Pdt.G/2026/PA.Dgl"
    );
    expect(hasil.teks).toContain("[NIK]");
    expect(hasil.teks).toContain("[TELEPON]");
    expect(hasil.teks).toContain("[SUREL]");
    expect(hasil.teks).toContain("PERKARA-");
    expect(hasil.dicurigai).toEqual([]);
  });

  it("garam yang berbeda menghasilkan sebutan nomor yang berbeda", () => {
    // Dua berkas tersamar tidak boleh dapat disatukan kembali menjadi satu
    // jati diri hanya dengan mencocokkan sebutannya.
    const satu = buatPenyamar("garam-a").samarkanTeks("perkara 545/Pdt.G/2026/PA.Dgl").teks;
    const dua = buatPenyamar("garam-b").samarkanTeks("perkara 545/Pdt.G/2026/PA.Dgl").teks;
    expect(satu).not.toBe(dua);
  });

  it("penyamaran tanpa garam ditolak, bukan dijalankan dengan garam kosong", () => {
    expect(() => buatPenyamar("")).toThrow(/garam/i);
  });

  it("yang masih menyerupai jati diri tetap ditandai", () => {
    // Pengenal bekerja atas bentuk tulisan, dan bentuk tulisan tidak pernah
    // menangkap semuanya.
    const penyamar = buatPenyamar("garam-uji");
    const hasil = penyamar.samarkanTeks("Nomor rekening 1234567890123456 atas nama pemilik.");
    expect(hasil.teks).toContain("[NIK]");
    expect(hasil.dicurigai).toEqual([]);
  });

  it("nama satu kata pada ruas bernama nama tetap tersamarkan", () => {
    // Pola dua-kata akan melewatkannya; nama ruaslah yang menentukan.
    const penyamar = buatPenyamar("garam-uji");
    expect(penyamar.samarkanNilai("Suparman", "namaSaksi")).toBe("Orang A");
  });
});
