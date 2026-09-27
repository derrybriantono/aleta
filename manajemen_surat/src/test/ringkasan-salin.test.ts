/**
 * ============================================================================
 * RINGKASAN YANG DISALIN - DIJALANKAN, BUKAN DISISIR TEKSNYA
 * ============================================================================
 *
 * Permintaan pengguna 27 September 2026, butir 4: "Salin ringkasan" memuat
 * data yang lebih lengkap. Yang dijaga di sini adalah TEKS YANG KELUAR -
 * baris demi baris - atas muatan yang menyerupai muatan bot sungguhan:
 *
 *   - seluruh kelompok yang diminta ada, dengan bentuk tanggal layar e-Court
 *   - ruas kosong TIDAK tertulis, dan kelompok kosong hilang beserta judulnya
 *   - sebutan pihak tidak pernah ditebak, dan tidak pernah TERTUKAR - diuji
 *     dua arah, sebab cacat yang tertukar selalu benar pada satu arah
 *   - muatan bot lama yang separuh kosong tidak menjatuhkannya
 *
 * Nama orang dan nomor perkara di sini karangan.
 */
import { describe, expect, it } from "vitest";

import { ringkasStatus, type BahanRingkas } from "@/lib/ringkas-status";
import {
  amarSingkat,
  sebutanRingkasan,
  susunRingkasanSalin,
  type BahanRingkasanSalin,
} from "@/lib/ringkasan-salin";

const HARI_INI = "2026-09-15";

function lengkap(ubah: Partial<BahanRingkasanSalin> = {}): BahanRingkasanSalin {
  return {
    identitas: {
      nomorPerkara: "123/Pdt.G/2026/PA.Dgl",
      jenisPerkara: "Cerai Gugat",
      jenisPerkaraLengkap: "Cerai Gugat",
      tanggalDaftar: "2026-07-01",
      alurPerkaraId: 15,
    },
    lewatEcourt: true,
    umur: { hariBersih: 60, hariBerjalan: 70, hariMediasi: 10, sudahPutus: true, sebabSelesai: "putus" },
    majelis: [
      { nama: "Dr. Fahri Hamzah, S.H.I.", jabatan: "Hakim Ketua" },
      { nama: "Nur Aisyah, S.Ag.", jabatan: "Hakim Anggota" },
    ],
    panitera: [{ nama: "Unun Sulastri" }],
    jurusita: [{ nama: "Munir, S.H." }],
    pihak: [
      { nama: "Nurhayati binti Abdullah", pihakKe: 1, jenis: "pihak" },
      { nama: "Rahmat bin Sulaiman", pihakKe: 2, jenis: "pihak" },
      { nama: "Budi Santoso, S.H.", pihakKe: 1, jenis: "kuasa" },
      { nama: "Saksi Pertama", pihakKe: 5, jenis: "pihak" },
    ],
    identitasPihak: { adaKuasa: true, adaKumulasi: false, kumulasi: [] },
    jadwal: [
      { tanggalSidang: "2026-08-05", jamSidang: "09:00:00", agenda: "Sidang Pertama", ditunda: true },
      { tanggalSidang: "2026-08-19", jamSidang: "09:30", agenda: "Pembuktian", ditunda: true },
      { tanggalSidang: "2026-09-09", jamSidang: "09:30", agenda: "Pembacaan Putusan", ditunda: false },
    ],
    penundaan: [{}, {}],
    putusan: {
      sudahPutus: true,
      tanggalPutusan: "2026-09-09",
      statusPutusan: "Dikabulkan",
      verstek: true,
      tanggalMinutasi: "2026-09-12",
      tanggalBht: "",
      aktaCerai: null,
      upayaHukum: [],
    },
    putusanLengkap: {
      ada: true,
      amar: "<ol><li>Mengabulkan gugatan Penggugat;</li><li>Menjatuhkan talak satu ba&#39;in sughra Tergugat (Rahmat bin Sulaiman) terhadap Penggugat (Nurhayati binti Abdullah);</li></ol>",
    },
    ikrarTalak: { ada: false },
    upayaHukum: [],
    mediasi: {
      terbaca: true,
      baris: [{ mediator: "Drs. Hasan Basri", hasil: "Tidak Berhasil", lamaHari: 10 }],
      mediator: [],
    },
    biaya: { panjar: 1_000_000, terpakai: 850_000, sisa: 150_000 },
    penilaian: { skor: 85, keadaan: "baik" },
    penanda: { ghaib: true, mafqud: false, instansi: [{ label: "PNS/ASN" }] },
    ...ubah,
  };
}

/** Ringkasan layar yang SUNGGUHAN - bukan karangan - atas bahan yang sama. */
function ringkasLayar(bahan: BahanRingkasanSalin) {
  return ringkasStatus(bahan as unknown as BahanRingkas, HARI_INI);
}

function susun(bahan: BahanRingkasanSalin, alamatSipp = "") {
  return susunRingkasanSalin(bahan, ringkasLayar(bahan), { hariIni: HARI_INI, alamatSipp });
}

function baris(teks: string) {
  return teks.split("\n");
}

describe("ringkasan lengkap", () => {
  it("memuat seluruh kelompok yang diminta, baris demi baris", () => {
    const teks = susun(lengkap(), "http://192.168.10.10/SIPP/perkara_detil_agama/QUJD");
    const b = baris(teks);

    for (const satu of [
      "Perkara 123/Pdt.G/2026/PA.Dgl",
      "Jenis perkara: Cerai Gugat",
      "Tanggal daftar: Rabu, 01-07-2026",
      "Jalur: e-Court",
      "Kuasa hukum: ada",
      "Verstek: ya",
      "Penanda: ghaib, PNS/ASN",
      "PARA PIHAK",
      "MAJELIS DAN PETUGAS",
      "Hakim Ketua: Dr. Fahri Hamzah, S.H.I.",
      "Hakim Anggota: Nur Aisyah, S.Ag.",
      "Panitera Pengganti: Unun Sulastri",
      "Jurusita: Munir, S.H.",
      "KEADAAN",
      "Keadaan: Sudah putus — Dikabulkan",
      "Lama perkara: 60 hari (70 hari daftar sampai putus, mediasi 10 hari)",
      "Nilai kelengkapan: 85 dari 100 (baik)",
      "SIDANG",
      "Jumlah sidang: 3 kali, 2 kali ditunda",
      "Sidang terakhir: Rabu, 09-09-2026 09:30 — Pembacaan Putusan",
      "MEDIASI",
      "Mediator: Drs. Hasan Basri",
      "Hasil mediasi: Tidak Berhasil (10 hari)",
      "PUTUSAN",
      "Tanggal putusan: Rabu, 09-09-2026",
      "Status putusan: Dikabulkan",
      "Minutasi: Sabtu, 12-09-2026",
      "BIAYA",
      "Panjar: Rp 1.000.000",
      "Terpakai: Rp 850.000",
      "Sisa panjar: Rp 150.000",
      "Halaman perkara di SIPP: http://192.168.10.10/SIPP/perkara_detil_agama/QUJD",
      "Disalin dari ALETA, Selasa, 15-09-2026.",
    ]) {
      expect(b, satu).toContain(satu);
    }

    // Amar dibersihkan dari tanda HTML dan entitasnya, dirangkai satu baris,
    // tanpa titik koma yang menggantung di ujungnya.
    const amar = b.find((x) => x.startsWith("Amar (ringkas): "));
    expect(amar).toBe(
      "Amar (ringkas): Mengabulkan gugatan Penggugat; Menjatuhkan talak satu ba'in sughra Tergugat (Rahmat bin Sulaiman) terhadap Penggugat (Nurhayati binti Abdullah)"
    );

    // Perlu tindakan diambil dari ringkasan LAYAR - di sini BHT yang kosong.
    const i = b.indexOf("PERLU TINDAKAN (1)");
    expect(i).toBeGreaterThan(-1);
    expect(b[i + 1]).toBe("- Tanggal berkekuatan hukum tetap belum tercatat");
  });

  it("tanpa tabel dan tanpa tanda WhatsApp: tiap baris berdiri sendiri", () => {
    const teks = susun(lengkap());
    expect(teks).not.toMatch(/\t|\|/);
    expect(teks).not.toMatch(/\*/);
    // Tiap baris isi berbentuk "Label: nilai", judul huruf besar, butir "- ",
    // atau baris kepala/penutup - tidak ada baris yang hanya potongan.
    for (const satu of baris(teks).filter(Boolean)) {
      expect(
        /^[A-Z][A-Z ]+( \(\d+\))?$/.test(satu) ||
          /^[A-Za-z][^:]*: \S/.test(satu) ||
          satu.startsWith("- ") ||
          satu.startsWith("Perkara ") ||
          satu.startsWith("Disalin dari ALETA"),
        satu
      ).toBe(true);
    }
    // Rupiah memakai spasi biasa, bukan spasi tak-terputus dari Intl.
    expect(teks).not.toContain(" ");
  });

  it("sidang HARI INI tetap disebut berikutnya - sama dengan kartu di layar", () => {
    const bahan = lengkap({
      umur: { hariBersih: 40, hariBerjalan: 76, hariMediasi: 0, sudahPutus: false },
      putusan: null,
      jadwal: [
        { tanggalSidang: "2026-09-01", jamSidang: "09:00", agenda: "Jawaban", ditunda: true },
        { tanggalSidang: HARI_INI, jamSidang: "10:00", agenda: "Replik", ditunda: false },
      ],
    });
    const b = baris(susun(bahan));
    expect(b).toContain("Sidang terakhir: Selasa, 01-09-2026 09:00 — Jawaban");
    expect(b).toContain("Sidang berikutnya: Selasa, 15-09-2026 10:00 — Replik");
    expect(b).toContain("Keadaan: Dalam persidangan");
  });

  it("perkara berjalan tanpa jadwal di depan menyebut 'belum terjadwal'", () => {
    const bahan = lengkap({
      umur: { hariBersih: 40, hariBerjalan: 76, hariMediasi: 0, sudahPutus: false },
      putusan: null,
      jadwal: [{ tanggalSidang: "2026-09-01", jamSidang: "09:00", agenda: "Jawaban", ditunda: true }],
    });
    expect(baris(susun(bahan))).toContain("Sidang berikutnya: belum terjadwal");
  });
});

describe("ruas kosong tidak ditulis", () => {
  it("kelompok yang kosong hilang BESERTA judulnya", () => {
    const teks = susun(
      lengkap({
        mediasi: { terbaca: true, baris: [], mediator: [] },
        biaya: { panjar: 0, terpakai: 0, sisa: 0 },
        jurusita: [],
        penanda: { ghaib: false, mafqud: false, instansi: [] },
        putusanLengkap: { ada: false, amar: "" },
      })
    );
    const b = baris(teks);
    expect(b).not.toContain("MEDIASI");
    expect(b).not.toContain("BIAYA");
    expect(teks).not.toMatch(/^Jurusita:/m);
    expect(teks).not.toMatch(/^Penanda:/m);
    expect(teks).not.toMatch(/^Amar/m);
  });

  it("tidak ada label tanpa nilai, dan tidak ada 'undefined' atau 'null'", () => {
    const teks = susun(
      lengkap({
        identitas: { nomorPerkara: "5/Pdt.P/2026/PA.Dgl", jenisPerkara: "", tanggalDaftar: "0000-00-00" },
        majelis: [{ nama: "  ", jabatan: "Hakim Ketua" }],
        panitera: [{ nama: "" }],
        putusan: {
          sudahPutus: true,
          tanggalPutusan: "2026-09-09",
          statusPutusan: "",
          tanggalMinutasi: "",
          tanggalBht: "bukan tanggal",
          aktaCerai: { nomor: "", tanggal: "", diserahkanPihak1: "", diserahkanPihak2: "" },
          upayaHukum: [{ jenis: "" }],
        },
      })
    );
    expect(teks).not.toMatch(/undefined|null|NaN|\[object/);
    expect(teks).not.toMatch(/:\s*$/m);
    expect(teks).not.toMatch(/^Tanggal daftar/m);
    expect(teks).not.toMatch(/^Jenis perkara/m);
    expect(teks).not.toMatch(/^Status putusan/m);
    expect(teks).not.toMatch(/^Minutasi/m);
    expect(teks).not.toMatch(/^Berkekuatan hukum tetap/m);
    expect(teks).not.toMatch(/^Akta cerai/m);
    expect(teks).not.toMatch(/^Upaya hukum/m);
    expect(teks).not.toMatch(/^Hakim Ketua/m);
    expect(teks).not.toMatch(/^Panitera Pengganti/m);
  });

  it("mediasi yang TIDAK TERBACA tidak disebut sebagai tanpa mediasi", () => {
    const teks = susun(
      lengkap({ mediasi: { terbaca: false, baris: [{ mediator: "X", hasil: "Berhasil", lamaHari: 3 }] } })
    );
    expect(teks).not.toContain("MEDIASI");
    expect(teks).not.toContain("Mediator: X");
  });

  it("alamat SIPP yang bukan http(s) mutlak tidak ikut ke pesan", () => {
    for (const buruk of ["javascript:alert(1)", "/aleta/aleta-sipp", "perkara_detil_agama/QUJD", "   "]) {
      const teks = susun(lengkap(), buruk);
      expect(teks, buruk).not.toContain("Halaman perkara di SIPP");
    }
  });

  it("muatan bot lama yang separuh kosong tidak menjatuhkannya", () => {
    const kurus = { identitas: { nomorPerkara: "9/Pdt.G/2026/PA.Dgl" } } as BahanRingkasanSalin;
    const ringkas = { keadaan: "Belum bersidang", peringatan: [] };
    let teks = "";
    expect(() => {
      teks = susunRingkasanSalin(kurus, ringkas, { hariIni: HARI_INI });
    }).not.toThrow();
    expect(baris(teks)).toEqual([
      "Perkara 9/Pdt.G/2026/PA.Dgl",
      "",
      "KEADAAN",
      "Keadaan: Belum bersidang",
      "",
      "Disalin dari ALETA, Selasa, 15-09-2026.",
    ]);
  });
});

describe("sebutan para pihak - pasti atau ganda, tidak pernah ditebak dan tidak tertukar", () => {
  it("alur gugatan TANPA nomor jenis memakai sebutan ganda - cerai talak pun alurnya gugatan", () => {
    // Cerai talak (346) beralur gugatan (15) tetapi bersebutan Pemohon.
    // Tanpa jenis_perkara_id, "Penggugat" di sini SALAH pada 1.178 perkara.
    const teks = susun(
      lengkap({
        identitas: {
          nomorPerkara: "77/Pdt.G/2026/PA.Dgl",
          jenisPerkara: "Cerai Talak",
          alurPerkaraId: 15,
        },
      })
    );
    const b = baris(teks);
    expect(b).toContain("Penggugat/Pemohon: Nurhayati binti Abdullah");
    expect(b).toContain("Tergugat/Termohon: Rahmat bin Sulaiman");
    expect(b).toContain("Kuasa Penggugat/Pemohon: Budi Santoso, S.H.");
    // Kata "Cerai Talak" TIDAK dipakai menebak - tidak ada "Pemohon:" tunggal.
    expect(teks).not.toMatch(/^Pemohon:/m);
    expect(teks).not.toMatch(/^Penggugat:/m);
  });

  it("alur DAN jenis diketahui: aturan ABT utuh - cerai talak menjadi Pemohon/Termohon", () => {
    const b = baris(
      susun(lengkap({ identitas: { nomorPerkara: "77/Pdt.G/2026/PA.Dgl", alurPerkaraId: 15, jenisPerkaraId: 346 } }))
    );
    expect(b).toContain("Pemohon: Nurhayati binti Abdullah");
    expect(b).toContain("Termohon: Rahmat bin Sulaiman");
    expect(b).toContain("Kuasa Pemohon: Budi Santoso, S.H.");
  });

  it("alur DAN jenis diketahui: cerai gugat menjadi Penggugat/Tergugat", () => {
    const b = baris(
      susun(lengkap({ identitas: { nomorPerkara: "78/Pdt.G/2026/PA.Dgl", alurPerkaraId: 15, jenisPerkaraId: 347 } }))
    );
    expect(b).toContain("Penggugat: Nurhayati binti Abdullah");
    expect(b).toContain("Tergugat: Rahmat bin Sulaiman");
  });

  it("alur permohonan (16) pasti Pemohon/Termohon, walau jenisnya tidak dikirim", () => {
    const b = baris(susun(lengkap({ identitas: { nomorPerkara: "5/Pdt.P/2026/PA.Dgl", alurPerkaraId: 16 } })));
    expect(b).toContain("Pemohon: Nurhayati binti Abdullah");
    expect(b).toContain("Termohon: Rahmat bin Sulaiman");
  });

  it("DUA ARAH: pihak_ke menentukan sisi - membalik pihak_ke membalik barisnya", () => {
    // Cacat yang menukar sisi selalu benar pada satu arah. Di sini kedua arah
    // dijalankan atas perkara yang sama.
    const identitas = { nomorPerkara: "5/Pdt.P/2026/PA.Dgl", alurPerkaraId: 16 };
    const maju = baris(
      susun(
        lengkap({
          identitas,
          pihak: [
            { nama: "Ani", pihakKe: 1, jenis: "pihak" },
            { nama: "Budi", pihakKe: 2, jenis: "pihak" },
            { nama: "Kuasa Budi", pihakKe: 2, jenis: "kuasa" },
          ],
        })
      )
    );
    expect(maju).toContain("Pemohon: Ani");
    expect(maju).toContain("Termohon: Budi");
    expect(maju).toContain("Kuasa Termohon: Kuasa Budi");

    const balik = baris(
      susun(
        lengkap({
          identitas,
          pihak: [
            { nama: "Ani", pihakKe: 2, jenis: "pihak" },
            { nama: "Budi", pihakKe: 1, jenis: "pihak" },
            { nama: "Kuasa Budi", pihakKe: 1, jenis: "kuasa" },
          ],
        })
      )
    );
    expect(balik).toContain("Termohon: Ani");
    expect(balik).toContain("Pemohon: Budi");
    expect(balik).toContain("Kuasa Pemohon: Kuasa Budi");
  });

  it("saksi (pihak_ke 3-5) tidak disebut sebagai pihak", () => {
    expect(susun(lengkap())).not.toContain("Saksi Pertama");
  });

  it("alur nol dari bot (tidak terbaca) bukan alur gugatan", () => {
    expect(sebutanRingkasan({ nomorPerkara: "x", alurPerkaraId: 0, jenisPerkaraId: 0 })).toEqual({
      satu: "Penggugat/Pemohon",
      dua: "Tergugat/Termohon",
      pasti: false,
    });
  });

  it("penyerahan akta cerai mengikuti sisi yang sama dengan daftar pihak", () => {
    const b = baris(
      susun(
        lengkap({
          identitas: { nomorPerkara: "77/Pdt.G/2026/PA.Dgl", alurPerkaraId: 15, jenisPerkaraId: 346 },
          putusan: {
            sudahPutus: true,
            tanggalPutusan: "2026-09-09",
            statusPutusan: "Dikabulkan",
            tanggalMinutasi: "2026-09-09",
            tanggalBht: "2026-09-23",
            aktaCerai: {
              nomor: "0123/AC/2026/PA.Dgl",
              tanggal: "2026-09-24",
              diserahkanPihak1: "2026-09-25",
              diserahkanPihak2: "2026-09-28",
            },
            upayaHukum: [],
          },
        })
      )
    );
    expect(b).toContain("Akta cerai: 0123/AC/2026/PA.Dgl, Kamis, 24-09-2026");
    expect(b).toContain("Akta cerai diserahkan kepada Pemohon: Jumat, 25-09-2026");
    expect(b).toContain("Akta cerai diserahkan kepada Termohon: Senin, 28-09-2026");
    expect(b).toContain("Berkekuatan hukum tetap: Rabu, 23-09-2026");
  });
});

describe("amar singkat", () => {
  it("dipotong pada batas kata dan diberi elipsis", () => {
    const panjang = `<p>${"Membebankan biaya perkara kepada Penggugat sejumlah ".repeat(10)}</p>`;
    const hasil = amarSingkat(panjang, 120);
    expect(hasil.length).toBeLessThanOrEqual(121);
    expect(hasil.endsWith("…")).toBe(true);
    expect(hasil).not.toMatch(/<|>/);
    // Tidak berhenti di tengah kata.
    expect(hasil.slice(0, -1)).toMatch(/\S$/);
    expect("Membebankan biaya perkara kepada Penggugat sejumlah".split(" ")).toContain(
      hasil.slice(0, -1).split(" ").pop()
    );
  });
});
