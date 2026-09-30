/**
 * Agen Penjaga Tenggat (Tahap 3) - mesin aturannya.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI ADALAH KEENGGANANNYA MENUDUH
 * ============================================================================
 *
 * Penjaga tenggat gagal dengan dua cara, dan keduanya tidak setara:
 *
 *   diam padahal ada yang terlewat   - satu pekerjaan tertinggal
 *   berbunyi padahal tidak ada apa-apa - SELURUH laporan berhenti dipercaya
 *
 * Yang kedua jauh lebih mahal, dan ia yang sudah terbukti hampir terjadi:
 * aturan versi pertama menghasilkan 99 tuduhan palsu dari 101. Karena itu
 * sebagian besar penjaga di berkas ini menguji bahwa mesinnya DIAM - pada
 * perkara yang dicabut, pada cerai talak yang belum ikrar, pada tumpukan
 * sebelum 2019.
 *
 * Seluruh angka pada komentar diukur 15 September 2026 atas sipp_donggala.
 */
import { describe, expect, it } from "vitest";

import {
  ATURAN_TENGGAT,
  BATAS_RINCI,
  CAKRAWALA_BULAN,
  PETA_ATURAN,
  STATUS_DIKABULKAN,
  type Aturan,
  type FaktaTenggat,
  nilaiSatu,
  nilaiTenggat,
  sebutSelisih,
  selisihHari,
  sebutPeristiwa,
  susunLaporanHarian,
  tanggalIso,
  tanggalPanjang,
  tumpukanLama,
} from "@/lib/penjaga-tenggat";

const HARI_INI = "2026-09-15";

function aturan(kode: string): Aturan {
  const a = PETA_ATURAN.get(kode);
  if (!a) throw new Error(`aturan ${kode} tidak ada`);
  return a;
}

function fakta(ubah: Partial<FaktaTenggat> = {}): FaktaTenggat {
  return {
    perkaraId: "9001",
    nomorPerkara: "100/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Talak",
    tanggalAcuan: "2026-01-01",
    statusPutusanId: STATUS_DIKABULKAN,
    ...ubah,
  };
}

// ============================================================================
describe("hitungan tanggal", () => {
  it("selisih hari tidak tergeser oleh zona waktu", () => {
    expect(selisihHari("2026-09-01", "2026-09-15")).toBe(14);
    expect(selisihHari("2026-09-15", "2026-09-01")).toBe(-14);
    expect(selisihHari("2026-02-28", "2026-03-01")).toBe(1);
  });

  it("tanggal dibaca dari Date maupun teks, dan yang tidak terbaca jadi kosong", () => {
    expect(tanggalIso(new Date(Date.UTC(2026, 8, 15, 12)))).toMatch(/^2026-09-1[45]$/);
    expect(tanggalIso("2026-09-15T00:00:00.000Z")).toBe("2026-09-15");
    expect(tanggalIso("bukan tanggal")).toBe("");
    expect(tanggalIso(null)).toBe("");
  });

  it("sebutan selisih membedakan lewat, tepat hari ini, dan sisa", () => {
    expect(sebutSelisih(12)).toBe("sudah 12 hari");
    expect(sebutSelisih(0)).toBe("jatuh tempo hari ini");
    expect(sebutSelisih(-3)).toBe("tinggal 3 hari");
  });

  it("tanggal panjang dalam bahasa Indonesia", () => {
    expect(tanggalPanjang("2026-09-15")).toBe("Selasa, 15 September 2026");
  });
});

// ============================================================================
describe("saringan yang mencegah 99 tuduhan palsu dari 101", () => {
  /**
   * Aturan versi pertama menangkap 66 cerai gugat yang "terlambat menerbitkan
   * akta cerai". Diperiksa satu per satu: seluruh 66 berstatus Dicabut,
   * Digugurkan, Ditolak, Tidak Dapat Diterima, atau Gugur - perceraian yang
   * tidak dikabulkan, yang akta cerainya memang tidak akan pernah terbit.
   */
  const STATUS_BUKAN_KABUL = [67, 65, 64, 93, 63];

  it("akta cerai TIDAK ditagih pada perceraian yang tidak dikabulkan", () => {
    for (const status of STATUS_BUKAN_KABUL) {
      const hasil = nilaiSatu(
        aturan("akta-cerai-gugat"),
        fakta({ jenisPerkara: "Cerai Gugat", tanggalAcuan: "2026-06-01", statusPutusanId: status }),
        HARI_INI
      );
      expect(hasil, `status ${status} seharusnya diam`).toBeNull();
    }
  });

  it("ikrar talak TIDAK ditagih pada perkara yang tidak dikabulkan", () => {
    // Dari 35 yang tertangkap tanpa saringan ini, 33 sama sekali tidak
    // menunggu ikrar.
    for (const status of STATUS_BUKAN_KABUL) {
      expect(
        nilaiSatu(aturan("ikrar-talak"), fakta({ tanggalAcuan: "2025-01-01", statusPutusanId: status }), HARI_INI)
      ).toBeNull();
    }
  });

  it("yang DIKABULKAN tetap ditagih - saringannya bukan pembungkam", () => {
    const hasil = nilaiSatu(
      aturan("ikrar-talak"),
      fakta({ tanggalAcuan: "2025-06-17", statusPutusanId: STATUS_DIKABULKAN }),
      HARI_INI
    );
    expect(hasil).not.toBeNull();
    expect(hasil!.tingkat).toBe("lewat");
  });

  it("status yang tidak diketahui diperlakukan sebagai bukan dikabulkan", () => {
    // Diam saat ragu. Menuduh saat ragu adalah cara laporan ini kehilangan
    // kepercayaan, dan kepercayaan itu tidak dapat dipulihkan dengan tambalan.
    expect(nilaiSatu(aturan("ikrar-talak"), fakta({ tanggalAcuan: "2025-01-01", statusPutusanId: null }), HARI_INI)).toBeNull();
  });
});

// ============================================================================
describe("cerai talak: akta cerai dihitung sejak IKRAR, bukan sejak BHT", () => {
  /**
   * Inilah aturan yang paling mudah ditulis keliru. Menghitungnya dari BHT
   * menuduh 16 perkara terlambat, padahal seluruh 16 sedang menunggu ikrarnya -
   * pekerjaan yang belum BOLEH dikerjakan, bukan yang terlambat.
   */
  it("dua aturan akta cerai memang berbeda dasarnya", () => {
    expect(aturan("akta-cerai-gugat").dasar).toMatch(/berkekuatan hukum tetap/i);
    expect(aturan("akta-cerai-talak").dasar).toMatch(/sejak ikrar talak/i);
    expect(aturan("akta-cerai-talak").dasar).toMatch(/BUKAN sejak BHT/);
  });

  it("sesudah ikrar lewat 14 hari, barulah ditagih", () => {
    // 2026-09-10 menyisakan 9 hari - DI LUAR jendela peringatan 7 hari, jadi
    // mesinnya diam. Itu benar: memperingatkan sembilan hari sebelumnya hanya
    // memanjangkan laporan tanpa menambah pekerjaan.
    expect(nilaiSatu(aturan("akta-cerai-talak"), fakta({ tanggalAcuan: "2026-09-10" }), HARI_INI)).toBeNull();
    // 2026-09-04 menyisakan 3 hari - barulah ia menyebut.
    const belum = nilaiSatu(aturan("akta-cerai-talak"), fakta({ tanggalAcuan: "2026-09-04" }), HARI_INI);
    expect(belum?.tingkat).toBe("menjelang");
    const sudah = nilaiSatu(aturan("akta-cerai-talak"), fakta({ tanggalAcuan: "2026-08-01" }), HARI_INI);
    expect(sudah?.tingkat).toBe("lewat");
    expect(sudah?.selisihHari).toBe(selisihHari("2026-08-01", HARI_INI) - 14);
  });
});

// ============================================================================
describe("relaas sidang pertama - tenggatnya jatuh SEBELUM tanggal acuannya", () => {
  /**
   * Diukur atas 2.039 sidang pertama setahun: jeda relaas ke sidang rata-rata
   * 16,6 hari, hanya 2,6% kurang dari 3 hari. Ambang 3 hari karena itu bukan
   * tebakan - ia jauh di bawah kebiasaan satker ini sendiri.
   */
  const relaas = () => aturan("relaas-sidang-pertama");

  it("ambangnya negatif, dan itu disengaja", () => {
    expect(relaas().batasHari).toBe(-3);
  });

  it("sidang hari ini tanpa relaas: sudah lewat", () => {
    const hasil = nilaiSatu(relaas(), fakta({ tanggalAcuan: HARI_INI, statusPutusanId: null }), HARI_INI);
    expect(hasil?.tingkat).toBe("lewat");
  });

  it("sidang lima hari lagi tanpa relaas: menjelang, belum menuduh", () => {
    const hasil = nilaiSatu(relaas(), fakta({ tanggalAcuan: "2026-09-20", statusPutusanId: null }), HARI_INI);
    expect(hasil?.tingkat).toBe("menjelang");
  });

  it("laporannya menyebut SIDANGNYA, bukan jarak ke ambang", () => {
    // "544/Pdt.G/2026 - sudah 3 hari - sidang 15-09-2026" pada 15 September
    // benar secara hitungan dan menyesatkan dibaca: sidangnya hari ini.
    // Yang membacanya harus tahu kapan sidangnya, bukan berapa jauh angka
    // dalam kepala mesin dari ambangnya.
    const rapor = nilaiTenggat(
      { "relaas-sidang-pertama": [fakta({ nomorPerkara: "544/X", tanggalAcuan: HARI_INI, statusPutusanId: null })] },
      HARI_INI
    );
    const teks = susunLaporanHarian(rapor);
    expect(teks).toContain("544/X — sidang hari ini");
    expect(teks).not.toContain("sudah 3 hari");
  });

  it("sebutan peristiwa membedakan hari ini, besok, dan sesudahnya", () => {
    expect(sebutPeristiwa(0)).toBe("hari ini");
    expect(sebutPeristiwa(1)).toBe("besok");
    expect(sebutPeristiwa(3)).toBe("3 hari lagi");
    expect(sebutPeristiwa(-1)).toBe("kemarin");
  });

  it("sidang dua pekan lagi: diam sama sekali", () => {
    // Juru sita masih punya waktu berlimpah. Menyebutnya sekarang hanya
    // menambah panjang laporan tanpa menambah pekerjaan.
    expect(nilaiSatu(relaas(), fakta({ tanggalAcuan: "2026-09-29", statusPutusanId: null }), HARI_INI)).toBeNull();
  });
});

// ============================================================================
describe("cakrawala - tumpukan lama dihitung, tidak diteriakkan", () => {
  /**
   * Akta cerai yang telat: 81 dari 2015, 24 dari 2016, 3 dari 2018, dan NOL
   * sejak 2019. Menyebutkannya tiap pagi selama bertahun-tahun adalah cara
   * tercepat membuat laporan ini diabaikan.
   */
  it("yang lebih tua dari cakrawala tidak pernah bertingkat lewat", () => {
    const lama = fakta({ jenisPerkara: "Cerai Gugat", tanggalAcuan: "2015-06-01" });
    expect(tumpukanLama("2015-06-01", HARI_INI)).toBe(true);
    expect(nilaiSatu(aturan("akta-cerai-gugat"), lama, HARI_INI)).toBeNull();
  });

  it("tetapi ia DIHITUNG, bukan dilupakan", () => {
    const rapor = nilaiTenggat(
      {
        "akta-cerai-gugat": [
          fakta({ jenisPerkara: "Cerai Gugat", tanggalAcuan: "2015-06-01", nomorPerkara: "1/2015" }),
          fakta({ jenisPerkara: "Cerai Gugat", tanggalAcuan: "2016-06-01", nomorPerkara: "2/2016" }),
          fakta({ jenisPerkara: "Cerai Gugat", tanggalAcuan: "2026-07-01", nomorPerkara: "3/2026" }),
        ],
      },
      HARI_INI
    );
    expect(rapor.tumpukanLama["akta-cerai-gugat"]).toBe(2);
    expect(rapor.butir).toHaveLength(1);
    expect(rapor.butir[0].nomorPerkara).toBe("3/2026");
  });

  it("tumpukan lama yang TIDAK dikabulkan tidak ikut dihitung", () => {
    // Kalau tidak, angka tumpukannya sendiri menjadi tuduhan yang keliru -
    // hanya tuduhan yang diringkas menjadi satu baris.
    const rapor = nilaiTenggat(
      { "akta-cerai-gugat": [fakta({ jenisPerkara: "Cerai Gugat", tanggalAcuan: "2015-06-01", statusPutusanId: 67 })] },
      HARI_INI
    );
    expect(rapor.tumpukanLama["akta-cerai-gugat"]).toBeUndefined();
  });

  it("cakrawalanya dua tahun, dan angkanya disebut di laporan", () => {
    expect(CAKRAWALA_BULAN).toBe(24);
  });
});

// ============================================================================
describe("rapor - urutan dan penghitungan", () => {
  it("yang paling lama terlampaui berdiri paling atas", () => {
    const rapor = nilaiTenggat(
      {
        "umur-perkara": [
          fakta({ nomorPerkara: "baru", tanggalAcuan: "2026-04-01", statusPutusanId: null }),
          fakta({ nomorPerkara: "lama", tanggalAcuan: "2026-01-05", statusPutusanId: null }),
        ],
      },
      HARI_INI
    );
    expect(rapor.butir.map((x) => x.nomorPerkara)).toEqual(["lama", "baru"]);
  });

  it("lewat mendahului menjelang, menjelang mendahului catatan", () => {
    const rapor = nilaiTenggat(
      {
        "akta-cerai-talak": [fakta({ nomorPerkara: "menjelang", tanggalAcuan: "2026-09-08" })],
        "ikrar-talak": [fakta({ nomorPerkara: "lewat", tanggalAcuan: "2025-06-01" })],
        "anonimisasi-hilang": [fakta({ nomorPerkara: "catatan", tanggalAcuan: "2026-07-09", statusPutusanId: null })],
      },
      HARI_INI
    );
    expect(rapor.butir.map((x) => x.tingkat)).toEqual(["lewat", "menjelang", "catatan"]);
    expect(rapor.hitung).toEqual({ lewat: 1, menjelang: 1, catatan: 1 });
  });

  it("hari yang bersih menghasilkan rapor kosong, bukan error", () => {
    const rapor = nilaiTenggat({}, HARI_INI);
    expect(rapor.butir).toHaveLength(0);
    expect(rapor.hitung).toEqual({ lewat: 0, menjelang: 0, catatan: 0 });
  });
});

// ============================================================================
describe("laporan harian WhatsApp", () => {
  it("HARI BERSIH TETAP DILAPORKAN", () => {
    // Laporan yang hanya terkirim ketika ada masalah tidak dapat dibedakan
    // dari laporan yang gagal terkirim. Yang menerimanya tidak pernah tahu
    // apakah pagi ini memang bersih atau botnya mati semalam.
    const teks = susunLaporanHarian(nilaiTenggat({}, HARI_INI), { satker: "PA Donggala" });
    expect(teks).toContain("PENJAGA TENGGAT PA Donggala");
    expect(teks).toContain("Selasa, 15 September 2026");
    expect(teks).toContain("Tidak ada tenggat yang terlampaui");
  });

  it("menyebut jumlah tiap tingkat pada kepalanya", () => {
    const rapor = nilaiTenggat(
      {
        "ikrar-talak": [fakta({ nomorPerkara: "A", tanggalAcuan: "2025-06-01" })],
        "akta-cerai-talak": [fakta({ nomorPerkara: "B", tanggalAcuan: "2026-09-08" })],
      },
      HARI_INI
    );
    const teks = susunLaporanHarian(rapor);
    expect(teks).toContain("1 lewat tenggat");
    expect(teks).toContain("1 menjelang");
  });

  it("dikelompokkan menurut aturan, dan tiap kelompok menyebut tindakannya", () => {
    const rapor = nilaiTenggat(
      { "ikrar-talak": [fakta({ nomorPerkara: "A", tanggalAcuan: "2025-06-01" })] },
      HARI_INI
    );
    const teks = susunLaporanHarian(rapor);
    expect(teks).toContain("Pasal 70 ayat (6) UU 7 Tahun 1989");
    expect(teks).toContain("→ Panggil Pemohon untuk ikrar sebelum penetapannya gugur.");
  });

  it("daftar panjang dipotong, sisanya disebut jumlahnya", () => {
    // Laporan yang menuntut digulung dua puluh layar tidak dibaca sampai
    // habis, dan yang di bawah tidak pernah terbaca sama sekali.
    const banyak = Array.from({ length: 9 }, (_, i) =>
      fakta({ nomorPerkara: `${i + 1}/Pdt.G/2025/PA.Dgl`, tanggalAcuan: "2025-01-01" })
    );
    const teks = susunLaporanHarian(nilaiTenggat({ "ikrar-talak": banyak }, HARI_INI));
    expect(teks).toContain(`…${9 - BATAS_RINCI} perkara lagi`);
    expect(teks.split("\n").filter((b) => b.startsWith("• "))).toHaveLength(BATAS_RINCI);
  });

  it("menyebut bahwa ia usulan, bukan perintah", () => {
    const teks = susunLaporanHarian(
      nilaiTenggat({ "ikrar-talak": [fakta({ tanggalAcuan: "2025-06-01" })] }, HARI_INI)
    );
    expect(teks).toContain("Yang memutus tetap pejabat yang berwenang.");
  });

  it("tumpukan lama disebut satu baris, tanpa dirinci", () => {
    const rapor = nilaiTenggat(
      {
        "akta-cerai-gugat": [
          fakta({ jenisPerkara: "Cerai Gugat", tanggalAcuan: "2015-06-01" }),
          fakta({ jenisPerkara: "Cerai Gugat", tanggalAcuan: "2016-06-01" }),
        ],
      },
      HARI_INI
    );
    const teks = susunLaporanHarian(rapor);
    expect(teks).toContain("Tumpukan lama");
    expect(teks).toContain("2 perkara");
    expect(teks).not.toContain("2015");
  });
});

// ============================================================================
describe("daftar aturan - bentuknya dijaga supaya tambahan berikutnya tidak lolos setengah jadi", () => {
  it("tiap aturan menyebut dasarnya dan tindakannya", () => {
    for (const a of ATURAN_TENGGAT) {
      expect(a.dasar.length, a.kode).toBeGreaterThan(8);
      expect(a.tindakan.length, a.kode).toBeGreaterThan(8);
      // Tindakan adalah kalimat perintah - yang membacanya harus tahu apa
      // yang dikerjakan, bukan sekadar bahwa ada yang salah.
      expect(a.tindakan.endsWith("."), a.kode).toBe(true);
    }
  });

  it("kodenya unik", () => {
    const kode = ATURAN_TENGGAT.map((a) => a.kode);
    expect(new Set(kode).size).toBe(kode.length);
  });

  it("aturan yang menyentuh perceraian menyaring status dikabulkan", () => {
    // Penjaga ini yang akan menangkap aturan BARU yang lupa menyaring -
    // kekeliruan yang sudah pernah menghasilkan 99 tuduhan palsu.
    for (const kode of ["ikrar-talak", "akta-cerai-gugat", "akta-cerai-talak"]) {
      expect(aturan(kode).hanyaDikabulkan, kode).toBe(true);
    }
  });

  it("tujuh aturan terdaftar, dan seluruhnya terbaca dari petanya", () => {
    expect(ATURAN_TENGGAT).toHaveLength(7);
    expect(PETA_ATURAN.size).toBe(7);
  });
});
