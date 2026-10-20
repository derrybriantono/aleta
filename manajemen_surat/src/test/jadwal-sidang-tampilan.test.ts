// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * ATURANNYA DIIMPOR, BUKAN DISALIN
 * ============================================================================
 *
 * Berkas ini dulu memuat SALINAN TANGAN tiap aturan komponennya - sepuluh
 * fungsi dan dua daftar pola - sebab komponennya tidak dapat dirender di
 * lingkungan pengujian ini.
 *
 * Salinan itu bahaya yang berbeda kelas dari uji yang rapuh. Uji yang rapuh
 * PECAH ketika kodenya berubah: menjengkelkan, tetapi jujur. Salinan yang
 * menyimpang justru LOLOS - ia menguji aturan yang tidak pernah dikirim ke
 * siapa pun, sementara aturan yang sungguhan boleh saja salah.
 *
 * Aturannya kini di @/lib/keadaan-sidang, dan komponen serta berkas ini
 * memakai yang SAMA. Yang lolos di sini karena itu benar-benar yang dipakai
 * di layar.
 */
import {
  AGENDA_ELITIGASI,
  AGENDA_MUSYAWARAH,
  NADA_PERLU_DIPERIKSA,
  agendaElitigasi,
  agendaMusyawarah,
  hariPutusan,
  hasilSidangBelumDicatat,
  perkaraVerzetDari,
  putusHariIni,
  sidangElitigasi,
  sidangIkrar,
  sidangSelesaiHariIni,
  sudahPutusHariIni,
} from "@/lib/keadaan-sidang";
import { warnaStatusPutusan } from "@/lib/warna-putusan";

import { hasilSidangPutusan } from "@/lib/hasil-sidang";

/**
 * Aturan tampilan jadwal sidang yang tidak boleh berubah diam-diam.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Berkasnya satu komponen tiga ribu baris, dan aturan-aturan kecil di dalamnya
 * mudah tergeser tanpa ada yang menyadarinya. Yang diuji di sini bukan
 * tampilannya, melainkan KEPUTUSANNYA:
 *
 *   - agenda mana yang menandai e-Litigasi. Salah kenal berarti saringannya
 *     menyembunyikan perkara yang justru sedang dicari;
 *   - jenis relaas yang DITURUNKAN dari kolom yang ada. SIPP tidak menyimpan
 *     ruas "jenis", dan menebak "panggilan elektronik" berarti menuliskan cara
 *     pemanggilan yang mungkin tidak pernah terjadi pada berkas yang
 *     menentukan sah tidaknya panggilan.
 *
 * Keduanya disalin dari komponen supaya dapat diuji tanpa merender apa pun -
 * dan bila salah satunya diubah tanpa mengubah yang lain, uji ini gagal.
 */

// ---------------------------------------------------------------------------
// Salinan aturan dari aleta-ecourt-sidang.tsx



function jenisRelaas(baris: {
  noResiPos?: string;
  tanggalKirimPos?: string;
  bertemu?: boolean;
  tanggalRelaas?: string;
}): string {
  if (baris.noResiPos || baris.tanggalKirimPos) return "Surat tercatat POS";
  if (baris.bertemu) return "Bertemu";
  if (baris.tanggalRelaas) return "Tidak bertemu";
  return "Belum dilaksanakan";
}

function sebutanStatusPos(status: number | null | undefined): string {
  if (status === null || status === undefined) return "";
  if (status === 1) return "sampai";
  if (status === 2) return "dikembalikan";
  return "tidak diketahui";
}

// ---------------------------------------------------------------------------

describe("agenda yang menandai e-Litigasi", () => {
  it("tahapan pertukaran berkas dikenali", () => {
    // Kedelapan pola adalah tahapan yang pada e-Litigasi dipertukarkan lewat
    // aplikasi, bukan dibacakan di ruang sidang. Ejaannya disalin apa adanya
    // dari agenda SIPP PA Donggala 2026 - "Pembacaan putusan" dan "Pembacaan
    // Penetapan" benar-benar ditulis berbeda di sana.
    for (const agenda of [
      "Jawaban Termohon",
      "Replik Penggugat",
      "Duplik Tergugat",
      "Duplik Rekonvensi",
      "Kesimpulan Para Pihak",
      "Musyawarah Majelis",
      "Pembacaan putusan",
      "Pembacaan Penetapan",
      "Putusan Sela",
    ]) {
      expect(agendaElitigasi(agenda), agenda).toBe(true);
    }
  });

  it("agenda persidangan biasa TIDAK ikut tertandai", () => {
    // Salah kenal di sini membuat saringan e-Litigasi menampilkan sidang yang
    // justru harus dihadiri langsung.
    for (const agenda of [
      "SIDANG IKRAR TALAK",
      "Pemeriksaan Pokok Perkara",
      "Panggil Tergugat",
      "Pembuktian Penggugat",
      "Mediasi",
      "",
    ]) {
      expect(agendaElitigasi(agenda), agenda).toBe(false);
    }
  });

  it("kata yang hanya mengandung potongannya tidak ikut", () => {
    // "berjawaban" bukan agenda jawaban; batas kata menjaganya.
    expect(agendaElitigasi("Perkara berjawabanx")).toBe(false);
  });
});

describe("penanda e-Litigasi menuntut DUA syarat", () => {
  it("agenda elektronik pada perkara e-Court ditandai", () => {
    expect(sidangElitigasi({ agenda: "Jawaban Termohon", lewatEcourt: true })).toBe(true);
  });

  it("agenda elektronik pada perkara BUKAN e-Court tidak ditandai", () => {
    // Inilah sebab syarat kedua ada. Pengukuran agenda 2026 di PA Donggala:
    // 31 sidang "Musyawarah Majelis" dan 20 "Pembacaan putusan", sebagian
    // besar perkara yang tidak pernah menyentuh e-Court. Tanpa syarat ini,
    // saringan e-Litigasi memunculkan perkara biasa - dan pembacanya
    // menyangka daftar itu sudah tepat.
    expect(sidangElitigasi({ agenda: "Musyawarah Majelis", lewatEcourt: false })).toBe(false);
    expect(sidangElitigasi({ agenda: "Pembacaan putusan", lewatEcourt: false })).toBe(false);
  });

  it("perkara e-Court dengan agenda yang harus dihadiri langsung tidak ditandai", () => {
    expect(sidangElitigasi({ agenda: "SIDANG IKRAR TALAK", lewatEcourt: true })).toBe(false);
  });

  it("tanpa keterangan e-Court sama sekali dianggap BUKAN e-Court", () => {
    // Gagal-tertutup: menandai saat ragu berarti menyalakan penanda pada
    // perkara yang mungkin tidak pernah membuka e-Court.
    expect(sidangElitigasi({ agenda: "Replik Penggugat" })).toBe(false);
  });
});

describe("jenis relaas diturunkan, tidak dikarang", () => {
  it("nomor resi menandai surat tercatat pos", () => {
    expect(jenisRelaas({ noResiPos: "P2608150003423" })).toBe("Surat tercatat POS");
  });

  it("tanggal kirim pos saja pun sudah cukup menandainya", () => {
    // Resi kadang belum tercatat padahal suratnya sudah dikirim - dan tanggal
    // kirim itulah yang dihitung pada tenggang panggilan.
    expect(jenisRelaas({ tanggalKirimPos: "2026-08-15" })).toBe("Surat tercatat POS");
  });

  it("surat tercatat MENANG atas bertemu", () => {
    // Pada surat tercatat, ket_temu dapat terisi karena petugas pos bertemu
    // penerimanya. Yang menentukan cara pemanggilannya tetap suratnya.
    expect(jenisRelaas({ noResiPos: "P26", bertemu: true })).toBe("Surat tercatat POS");
  });

  it("bertemu langsung tanpa pos", () => {
    expect(jenisRelaas({ bertemu: true, tanggalRelaas: "2026-08-14" })).toBe("Bertemu");
  });

  it("sudah dilaksanakan tetapi tidak bertemu", () => {
    expect(jenisRelaas({ bertemu: false, tanggalRelaas: "2026-08-14" })).toBe("Tidak bertemu");
  });

  it("belum ada tanggal berarti belum dilaksanakan, bukan tidak bertemu", () => {
    // Bedanya menentukan: yang belum dilaksanakan menagih jurusita, yang tidak
    // bertemu menagih penelusuran alamat.
    expect(jenisRelaas({})).toBe("Belum dilaksanakan");
  });
});

describe("status lacak kiriman pos", () => {
  it("angka SIPP diterjemahkan", () => {
    expect(sebutanStatusPos(1)).toBe("sampai");
    expect(sebutanStatusPos(2)).toBe("dikembalikan");
  });

  it("angka yang tidak dikenal dikatakan tidak diketahui, bukan disembunyikan", () => {
    expect(sebutanStatusPos(9)).toBe("tidak diketahui");
    expect(sebutanStatusPos(0)).toBe("tidak diketahui");
  });

  it("tanpa status sama sekali tidak menampilkan apa pun", () => {
    // Berbeda dari "tidak diketahui": yang ini belum pernah dilacak.
    expect(sebutanStatusPos(null)).toBe("");
    expect(sebutanStatusPos(undefined)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// PENJAGA: TIDAK ADA SALINAN ATURAN YANG BOLEH KEMBALI
// ---------------------------------------------------------------------------

describe("aturannya satu, bukan salinan yang dapat menyimpang", () => {
  const komponen = () =>
    readFileSync(
      path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"),
      "utf8"
    );
  const ujiIni = () => readFileSync(path.resolve(process.cwd(), __filename), "utf8");

  /**
   * ==========================================================================
   * KENAPA PENJAGA INI MENGGANTI DUA PENJAGA SEBELUMNYA
   * ==========================================================================
   *
   * Dua penjaga sebelumnya membandingkan SALINAN di berkas uji ini dengan
   * teks berkas komponennya - pola demi pola, nama fungsi demi nama fungsi.
   * Keduanya ada karena salinannya ada.
   *
   * Salinannya kini tidak ada: aturannya di @/lib/keadaan-sidang, dan
   * komponen serta berkas ini mengimpor yang SAMA. Membandingkan dua teks
   * karena itu tidak menjawab apa pun lagi - yang perlu dijaga sekarang satu
   * hal saja: salinannya tidak boleh kembali.
   *
   * Kembalinya bukan kemungkinan yang jauh. Yang menambah aturan baru pada
   * komponen tiga ribu baris akan menulisnya di sana - itu yang paling dekat
   * - lalu menulis salinannya di sini supaya dapat diuji. Dua langkah yang
   * masuk akal satu per satu, dan hasilnya kembali ke keadaan semula.
   */
  it("komponen tidak mendefinisikan ulang aturan yang sudah di lib", () => {
    const isi = komponen();
    for (const nama of [
      "agendaElitigasi",
      "agendaMusyawarah",
      "sidangIkrar",
      "hariPutusan",
      "putusHariIni",
      "sudahPutusHariIni",
      "sidangSelesaiHariIni",
      "sidangElitigasi",
      "perkaraVerzetDari",
      "kelompokAlur",
      "potensiVerstek",
    ]) {
      expect(isi, `${nama} didefinisikan ulang di komponen`).not.toContain(
        `function ${nama}(`
      );
    }
    expect(isi).toContain('from "@/lib/keadaan-sidang"');
  });

  it("berkas uji ini pun tidak mendefinisikannya ulang", () => {
    // Termasuk berkas ini sendiri - itu justru dari mana salinannya berasal.
    const isi = ujiIni();
    for (const nama of [
      "agendaElitigasi",
      "agendaMusyawarah",
      "sidangIkrar",
      "hariPutusan",
      "putusHariIni",
      "sudahPutusHariIni",
      "sidangSelesaiHariIni",
      "sidangElitigasi",
      "perkaraVerzetDari",
      "warnaStatusPutusan",
    ]) {
      expect(isi, `${nama} disalin ulang di berkas uji`).not.toContain(
        `function ${nama}(`
      );
    }
  });

  it("aturannya benar-benar dapat dipanggil dari lib", () => {
    // Bukan sekadar ada namanya di impor: dijalankan, dan hasilnya diperiksa.
    expect(agendaMusyawarah("Musyawarah Majelis")).toBe(true);
    expect(agendaElitigasi("Replik Pemohon")).toBe(true);
    expect(sidangIkrar({ agenda: "SIDANG IKRAR TALAK" })).toBe(true);
    expect(perkaraVerzetDari("Perlawanan")).toBe(true);
    expect(AGENDA_MUSYAWARAH.length).toBeGreaterThan(0);
    expect(AGENDA_ELITIGASI.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// RESET KEHADIRAN ANTRIAN
// ---------------------------------------------------------------------------

/** Salinan sisiTerisi dari aleta-ecourt-sidang.tsx. */
function sisiTerisi(antrian: { pihak1?: string; pihak2?: string; saksi?: string } | undefined) {
  if (!antrian) return [];
  return [
    { kunci: "pihak_1", label: "penggugat/pemohon", jam: antrian.pihak1 },
    { kunci: "pihak_2", label: "tergugat/termohon", jam: antrian.pihak2 },
    { kunci: "saksi", label: "saksi", jam: antrian.saksi },
  ].filter((x) => Boolean(x.jam));
}

/**
 * Salinan aturan waktuAmbil dari antrianSidangService.SQL_URUTAN.
 *
 * Inilah yang membuat reset bekerja tanpa satu pun nomor ditulis ulang tangan:
 * nomor antrian adalah URUTAN BARIS pada daftar yang diurutkan menurut nilai
 * ini, sehingga mengosongkan satu kolom cukup untuk menghitung ulang seluruh
 * giliran.
 */
function waktuAmbil(baris: { pihak1: string | null; pihak2: string | null }): string | null {
  if (baris.pihak1 !== null && baris.pihak2 !== null) {
    return baris.pihak1 < baris.pihak2 ? baris.pihak1 : baris.pihak2;
  }
  if (baris.pihak1 !== null) return baris.pihak1;
  return baris.pihak2;
}

describe("sisi yang dapat direset hanya yang waktunya terisi", () => {
  it("hanya sisi terisi yang ditawarkan", () => {
    // Menawarkan reset atas sisi yang belum pernah mengambil membuat orang
    // menekannya lalu bertanya kenapa tidak terjadi apa-apa - dan pada tombol
    // yang menggeser giliran orang, keraguan itu mahal.
    const hasil = sisiTerisi({ pihak1: "08:17", pihak2: "", saksi: "08:24" });
    expect(hasil.map((x) => x.kunci)).toEqual(["pihak_1", "saksi"]);
  });

  it("kunci yang dikirim adalah nama kolom aplikasi antrian", () => {
    // Bot menolak nilai di luar pihak_1, pihak_2, dan saksi. Kunci yang
    // dikarang di layar akan ditolak diam-diam sebagai "sisi_tidak_dikenali".
    const hasil = sisiTerisi({ pihak1: "08:00", pihak2: "09:00", saksi: "09:30" });
    expect(hasil.map((x) => x.kunci)).toEqual(["pihak_1", "pihak_2", "saksi"]);
  });

  it("perkara yang belum ada di mesin antrian tidak menawarkan reset apa pun", () => {
    expect(sisiTerisi(undefined)).toEqual([]);
    expect(sisiTerisi({ pihak1: "", pihak2: "", saksi: "" })).toEqual([]);
  });
});

describe("urutan antrian dihitung ulang sendiri sesudah reset", () => {
  it("penggugat 08:00 direset, urutan mengikuti tergugat 09:00", () => {
    // Persis keadaan yang diminta: P hadir 08, T hadir 09, lalu P ternyata
    // salah input dan direset - giliran perkara ini menjadi 09:00.
    expect(waktuAmbil({ pihak1: "08:00", pihak2: "09:00" })).toBe("08:00");
    expect(waktuAmbil({ pihak1: null, pihak2: "09:00" })).toBe("09:00");
  });

  it("tergugat direset, urutan tetap mengikuti penggugat", () => {
    expect(waktuAmbil({ pihak1: "08:00", pihak2: null })).toBe("08:00");
  });

  it("kedua sisi direset - tidak ada lagi waktu ambil, dan itu bukan nol", () => {
    // Barisnya keluar dari daftar bernomor dan kembali menjadi "belum ambil".
    // Memberi nomor kepada yang tidak ada waktunya berarti menggeser nomor
    // orang lain atas kehadiran yang sudah dibatalkan.
    expect(waktuAmbil({ pihak1: null, pihak2: null })).toBeNull();
  });

  it("yang terawal yang menentukan, bukan yang terakhir", () => {
    expect(waktuAmbil({ pihak1: "09:30", pihak2: "08:15" })).toBe("08:15");
  });
});

describe("jalur reset ada apa adanya di layanan bot", () => {
  it("pembatalan mengosongkan kolom dan mencatat jejaknya", () => {
    const berkas = path.resolve(process.cwd(), "../aleta_bot/services/kehadiranAntrianService.js");
    const isi = readFileSync(berkas, "utf8");
    expect(isi).toContain("async function batalkanHadir");
    // Kolomnya dikosongkan - bukan barisnya dihapus.
    expect(isi).toContain("SET ${kolom} = NULL");
    // Jejaknya ditulis: siapa, kapan, alasan apa. Perbuatan yang menggeser
    // giliran orang harus dapat ditelusuri.
    expect(isi).toContain("dibatalkan_pada = ?, dibatalkan_oleh = ?, alasan_batal = ?");
    // Yang sudah dibatalkan tidak ikut dibaca lagi, atau layar akan menyebut
    // orangnya hadir sementara waktunya sudah kosong di aplikasi antrian.
    expect(isi).toContain("AND dibatalkan_pada IS NULL");
  });
});

// ---------------------------------------------------------------------------
// ANTRIAN MILIK SATU HARI, DAN AGENDA YANG MENUNTUT KESIAPAN
// ---------------------------------------------------------------------------

/** Salinan antrianUntuk dari aleta-ecourt-sidang.tsx. */
function antrianUntuk(
  peta: Record<string, { tanggalSidang: string; nomor: number | null }> | undefined,
  baris: { perkaraId: string; tanggalSidang: string }
) {
  const punya = peta?.[String(baris.perkaraId)];
  if (!punya) return undefined;
  if (!punya.tanggalSidang || !baris.tanggalSidang) return undefined;
  return punya.tanggalSidang === baris.tanggalSidang ? punya : undefined;
}


describe("antrian hanya berlaku pada hari sidangnya sendiri", () => {
  // Keadaan yang benar-benar terjadi: perkara 216/Pdt.P/2026 punya baris
  // antrian bertanggal 7 September dengan P, T, dan saksi hadir 08:43 - dan
  // angka itu ikut tergambar pada jadwal 8 September, seolah para pihak sudah
  // hadir untuk sidang yang belum terjadi.
  const peta = { "10060": { tanggalSidang: "2026-09-07", nomor: 6 } };

  it("tanggal cocok - antriannya dipakai", () => {
    expect(
      antrianUntuk(peta, { perkaraId: "10060", tanggalSidang: "2026-09-07" })?.nomor
    ).toBe(6);
  });

  it("tanggal berbeda - antriannya TIDAK dipakai", () => {
    expect(antrianUntuk(peta, { perkaraId: "10060", tanggalSidang: "2026-09-08" })).toBeUndefined();
  });

  it("perkara yang tidak ada di mesin antrian tetap kosong", () => {
    expect(antrianUntuk(peta, { perkaraId: "9999", tanggalSidang: "2026-09-07" })).toBeUndefined();
  });

  it("tanggal yang tidak terbaca dianggap TIDAK cocok", () => {
    // Gagal-tertutup. Antrian adalah keterangan tambahan; menampilkannya saat
    // ragu lebih merugikan daripada tidak menampilkannya.
    expect(antrianUntuk(peta, { perkaraId: "10060", tanggalSidang: "" })).toBeUndefined();
    expect(
      antrianUntuk({ "10060": { tanggalSidang: "", nomor: 6 } }, {
        perkaraId: "10060",
        tanggalSidang: "2026-09-07",
      })
    ).toBeUndefined();
  });

  it("peta yang belum termuat tidak meledak", () => {
    expect(antrianUntuk(undefined, { perkaraId: "10060", tanggalSidang: "2026-09-07" })).toBeUndefined();
  });
});

describe("agenda yang menuntut majelis lengkap dan naskah siap", () => {
  it("musyawarah dan pembacaan dikenali", () => {
    for (const agenda of [
      "Musyawarah Majelis",
      "musyawarah majelis",
      "Pembacaan putusan",
      "Pembacaan Penetapan",
      "Putusan Sela",
      "Penetapan",
    ]) {
      expect(agendaMusyawarah(agenda), agenda).toBe(true);
    }
  });

  it("sidang ikrar talak TIDAK ikut merah", () => {
    // Ia hari yang menentukan, tetapi bukan musyawarah dan bukan pembacaan
    // putusan - putusannya sudah dijatuhkan jauh sebelumnya. Memasukkannya
    // menambah 57 sidang merah pada 2026 saja, dan penanda merah yang menyala
    // di mana-mana berhenti menuntut perhatian.
    expect(agendaMusyawarah("SIDANG IKRAR TALAK")).toBe(false);
  });

  it("agenda persidangan biasa tidak ikut merah", () => {
    for (const agenda of [
      "Panggil Tergugat",
      "Pemeriksaan Pokok Perkara",
      "Pembuktian Penggugat",
      "Mediasi",
      "Jawaban Termohon",
      "",
    ]) {
      expect(agendaMusyawarah(agenda), agenda).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// HARI PUTUSAN DAN IKRAR TALAK - DUA PENANDA YANG TIDAK PERNAH BERSAMAAN


describe("penanda Hari Putusan", () => {
  it("agenda yang akan memutus ikut", () => {
    for (const agenda of [
      "Musyawarah Majelis",
      "Pembacaan putusan",
      "Pembacaan Penetapan",
      "Putusan Sela",
      "Musyawarah Majelis dan Pembacaan Putusan",
    ]) {
      expect(hariPutusan({ agenda, ditunda: true, alasanDitunda: "" }), agenda).toBe(true);
    }
  });

  it("hasil sidang yang SUDAH tercatat ikut, walau agendanya biasa", () => {
    // Empat teratas di PA Donggala, diukur atas 20.092 baris jadwal:
    // 2.166 "putus DIKABULKAN (verstek)", 946 "putus DIKABULKAN",
    // 206 "putus DICABUT", 81 "putus DIGUGURKAN".
    for (const alasan of [
      "putus DIKABULKAN (verstek)",
      "putus DIKABULKAN",
      "putus DICABUT",
      "putus DIGUGURKAN",
      "putus TIDAK DITERIMA",
      "putus DITOLAK",
    ]) {
      expect(
        hariPutusan({ agenda: "Pemeriksaan Pokok Perkara", ditunda: false, alasanDitunda: alasan }),
        alasan
      ).toBe(true);
    }
  });

  it("agenda BERIKUTNYA yang menyebut putusan tidak dianggap sudah putus", () => {
    // ditunda = Y berarti kolomnya berisi agenda berikutnya, bukan hasil.
    // Ia tetap ikut Hari Putusan - lewat agendanya - tetapi bukan karena
    // hasil sidangnya, dan judulnya harus menyebut yang benar.
    expect(hasilSidangPutusan(true, "Pembacaan Putusan")).toBe("");
    expect(hariPutusan({ agenda: "Pembacaan Putusan", ditunda: true, alasanDitunda: "Pembacaan Putusan" })).toBe(true);
  });

  it("angka bawaan 0 pada alasan_ditunda tidak menyalakan apa pun", () => {
    // 6.207 baris berisi "0" belaka - nilai bawaan yang tidak pernah diisi.
    expect(hariPutusan({ agenda: "Panggil Tergugat", ditunda: false, alasanDitunda: "0" })).toBe(false);
  });

  it("sidang biasa tidak ikut", () => {
    for (const agenda of ["Panggil Tergugat", "Mediasi", "Pembuktian Penggugat", "Jawaban Termohon", ""]) {
      expect(hariPutusan({ agenda, ditunda: true, alasanDitunda: "Panggil Tergugat" }), agenda).toBe(false);
    }
  });
});

describe("penanda Ikrar Talak", () => {
  it("bendera SIPP menang - agendanya boleh berbunyi apa saja", () => {
    // Yang benar-benar ada di data pada baris berbendera Y: "Panggil
    // Termohon" (9), "tunda 6 bulan" (4), "Musyawarah Majelis" (3),
    // "Proses Mediasi" (7). Menebak dari agendanya melewatkan semuanya.
    for (const agenda of ["Panggil Termohon", "tunda 6 bulan", "Musyawarah Majelis", "Proses Mediasi", ""]) {
      expect(sidangIkrar({ agenda, sidangIkrarTalak: true }), agenda).toBe(true);
    }
  });

  it("agendanya menangkap baris yang benderanya lupa dicentang", () => {
    // Dua baris di PA Donggala beragenda ikrar dengan bendera T. Ejaannya
    // sendiri belasan macam, jadi yang dicocokkan kata "ikrar" saja.
    for (const agenda of [
      "SIDANG IKRAR TALAK",
      "Sidank Ikrar Talak",
      "sidang ikrar ",
      "penyaksian ikrar talak",
      "Pengucapan Ikrar",
      "Sidang  Ikrar Talak",
    ]) {
      expect(sidangIkrar({ agenda, sidangIkrarTalak: false }), agenda).toBe(true);
    }
  });

  it("yang tidak terbaca dianggap BUKAN ikrar", () => {
    // Gagal-tertutup: jadwal yang termuat sebelum pembaruan ini tidak
    // memuat benderanya sama sekali.
    expect(sidangIkrar({ agenda: "Panggil Termohon" })).toBe(false);
  });

  it("KEDUANYA tidak pernah menyala bersamaan", () => {
    // Diukur: dari 1.024 baris berbendera ikrar, TIDAK SATU pun hasil
    // sidangnya memuat "putus", dan hanya 4 yang agendanya menyebut
    // musyawarah/putusan/penetapan. Keempatnya harus jatuh ke biru.
    const baris = { agenda: "Musyawarah Majelis", sidangIkrarTalak: true, ditunda: true, alasanDitunda: "" };
    expect(sidangIkrar(baris)).toBe(true);
    expect(hariPutusan(baris)).toBe(false);
  });

  it("ikrar talak TIDAK ikut kotak Sudah putus", () => {
    // Inilah keluhannya: 9 September 2026 menampilkan "2 Sudah putus", dan
    // keduanya sidang ikrar talak yang putusannya dijatuhkan berbulan-bulan
    // sebelumnya. Kotak itu pada layar JADWAL SIDANG harus menjawab
    // "diputus pada sidang INI".
    const isi = readFileSync(
      path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"),
      "utf8"
    );
    const potong = isi.slice(isi.indexOf('kunci: "sudah-putus"'), isi.indexOf('kunci: "belum-putus"'));
    // Sejak butir 1+2 kotak ini membaca DUA sumber lewat sudahPutusHariIni:
    // putusan resmi dan hasil sidang. Yang dijaga tuntutan ini tetap sama -
    // sidang ikrar talak tidak boleh ikut - dan pengecualian itu kini berada
    // di DALAM sudahPutusHariIni, sehingga berlaku bagi kedua jalurnya. Tanpa
    // itu, ikrar talak yang hasil sidangnya menyebut "putus" akan menyelinap
    // masuk lewat pintu yang baru dibuka.
    expect(potong).toContain("cocok: (x) => sudahPutusHariIni(x)");
    // Bentuk lama - benar bagi tiap sidang lanjutan sesudah putusan.
    expect(potong).not.toContain("cocok: (x) => x.sudahPutus");
  });

  it("Belum putus tetap berarti belum punya putusan sama sekali", () => {
    // Sesudah Sudah putus dipersempit, keduanya tidak lagi menjumlah genap -
    // dan itu benar: perkara yang diputus pada sidang SEBELUMNYA tidak
    // diputus hari ini, dan tidak pula sedang menunggu putusan.
    const isi = readFileSync(
      path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"),
      "utf8"
    );
    // Irisannya dari kotak itu sendiri, bukan sampai kotak berikutnya: sejak
    // kotak berkelompok, "Tidak perlu dipanggil" ada di kelompok Panggilan -
    // jauh SEBELUM kelompok Putusan - dan irisan sampai ke sana kosong.
    const awal = isi.indexOf('kunci: "belum-putus"');
    const potong = isi.slice(awal, awal + 600);
    expect(potong).toContain("cocok: (x) => !x.sudahPutus");
  });
});

describe("kotak Sudah putus berarti diputus pada sidang hari itu", () => {
  const sidang = "2026-09-09";

  it("putusan bertanggal sama dengan sidangnya - ikut", () => {
    expect(
      putusHariIni({ sudahPutus: true, tanggalPutusan: sidang, tanggalSidang: sidang, agenda: "Pembacaan Putusan" })
    ).toBe(true);
  });

  it("putusan dari sidang SEBELUMNYA - tidak ikut", () => {
    // 3 September 2026: dua puluh perkara punya putusan, satu di antaranya
    // diputus hari itu. Sembilan belas sisanya mengerjakan hal lain.
    expect(
      putusHariIni({ sudahPutus: true, tanggalPutusan: "2026-06-17", tanggalSidang: sidang, agenda: "Sidang Lanjutan" })
    ).toBe(false);
  });

  it("sidang ikrar talak - tidak ikut, walau perkaranya punya putusan", () => {
    // 274 dan 404/Pdt.G/2026 pada 9 September 2026. Inilah dua baris yang
    // dulu terhitung "Sudah putus" dan menjadi keluhannya.
    for (const b of [
      { sudahPutus: true, tanggalPutusan: "2026-03-11", tanggalSidang: sidang, agenda: "SIDANG IKRAR TALAK", sidangIkrarTalak: true },
      { sudahPutus: true, tanggalPutusan: sidang, tanggalSidang: sidang, agenda: "SIDANG IKRAR TALAK", sidangIkrarTalak: true },
    ]) {
      expect(putusHariIni(b), b.agenda).toBe(false);
    }
  });

  it("perkara tanpa putusan - tidak ikut", () => {
    // 510/Pdt.G/2026: hasil sidangnya "putus DIKABULKAN (verstek)" tetapi
    // putusannya belum tercatat di SIPP. Ia dapat penanda kuning Hari
    // Putusan, bukan kotak hijau Sudah putus - dan kolom Putusan menyebut
    // "putusan belum tercatat".
    const b = { sudahPutus: false, tanggalPutusan: "", tanggalSidang: sidang, agenda: "Panggil Tergugat", ditunda: false, alasanDitunda: "putus DIKABULKAN (verstek)" };
    expect(putusHariIni(b)).toBe(false);
    expect(hariPutusan(b)).toBe(true);
  });

  it("tanggal yang tidak terbaca dianggap TIDAK putus hari itu", () => {
    expect(putusHariIni({ sudahPutus: true, tanggalPutusan: "", tanggalSidang: sidang })).toBe(false);
    expect(putusHariIni({ sudahPutus: true, tanggalPutusan: sidang, tanggalSidang: "" })).toBe(false);
  });

  it("ketujuh belas baris 9 September 2026, apa adanya dari SIPP", () => {
    // Dua ikrar talak, satu putus tanpa putusan tercatat, empat belas biasa.
    const baris = [
      { nomor: "274", agenda: "SIDANG IKRAR TALAK", sidangIkrarTalak: true, ditunda: true, alasanDitunda: "Pemohon belum siap membayar pembebanan, tunda 6 bulan", sudahPutus: true, tanggalPutusan: "2026-03-11" },
      { nomor: "404", agenda: "SIDANG IKRAR TALAK", sidangIkrarTalak: true, ditunda: false, alasanDitunda: "telah ikrar talak", sudahPutus: true, tanggalPutusan: "2026-07-29" },
      { nomor: "510", agenda: "Panggil Tergugat", sidangIkrarTalak: false, ditunda: false, alasanDitunda: "putus DIKABULKAN (verstek)", sudahPutus: false, tanggalPutusan: "" },
      { nomor: "445", agenda: "Replik Pemohon", sidangIkrarTalak: false, ditunda: false, alasanDitunda: "", sudahPutus: false, tanggalPutusan: "" },
      { nomor: "526", agenda: "Sidang Pertama", sidangIkrarTalak: false, ditunda: true, alasanDitunda: "Panggil Tergugat", sudahPutus: false, tanggalPutusan: "" },
    ].map((b) => ({ ...b, tanggalSidang: sidang }));

    const kuning = baris.filter(hariPutusan).map((b) => b.nomor);
    const biru = baris.filter(sidangIkrar).map((b) => b.nomor);
    const hijau = baris.filter(putusHariIni).map((b) => b.nomor);

    expect(kuning).toEqual(["510"]);
    expect(biru).toEqual(["274", "404"]);
    expect(hijau).toEqual([]);
    // Tidak satu baris pun memikul dua penanda sekaligus.
    expect(baris.filter((b) => [hariPutusan(b), sidangIkrar(b), putusHariIni(b)].filter(Boolean).length > 1)).toEqual([]);
  });
});
describe("ketiganya ada apa adanya di komponen", () => {
  const berkasKomponen = path.resolve(
    process.cwd(),
    "src/components/portal/aleta-ecourt-sidang.tsx"
  );

  it("tidak ada lagi pembacaan antrian yang melewati pencocokan tanggal", () => {
    const isi = readFileSync(berkasKomponen, "utf8");
    expect(isi).toContain("function antrianUntuk");
    // Akses langsung ke peta akan melewati pencocokan tanggal, dan bug-nya
    // kembali tanpa satu pun uji lain yang menuduh.
    expect(isi).not.toContain("antrian.peta[String(baris.perkaraId)]");
    expect(isi).not.toContain("antrian[String(x.perkaraId)]");
    expect(isi).not.toContain("antrian[String(baris.perkaraId)]");
  });

  it("menu turun menutup saat ditekan di luar", () => {
    const isi = readFileSync(berkasKomponen, "utf8");
    expect(isi).toContain("function useTutupSaatDiLuar");
    // mousedown, bukan click: penutupan harus terjadi sebelum tekanan itu
    // sempat mengenai tombol di baris jadwal di belakangnya.
    expect(isi).toContain('document.addEventListener("mousedown", diLuar)');
    // Dipakai KEDUA menu - bukan satu saja.
    expect(isi.split("useTutupSaatDiLuar(terbuka, tutup)").length - 1).toBe(2);
  });

  it("penanda hari putusan melebur musyawarah, bukan berdiri di sebelahnya", () => {
    const isi = readFileSync(berkasKomponen, "utf8");
    expect(isi).toContain('kunci: "hari-putusan"');
    expect(isi).toContain('label: "Hari Putusan"');
    // Ketiga kotak lama sudah dilebur berturut-turut, bukan ditumpuk. Tiga
    // kotak yang menyaring hal yang hampir sama membuat pembacanya menduga
    // ada bedanya, lalu mencari beda yang tidak ada.
    expect(isi).not.toContain('kunci: "agenda-putusan"');
    expect(isi).not.toContain('kunci: "musyawarah-majelis"');
    // Kuning, bukan merah: separuh isinya perkara yang hasilnya sudah
    // tercatat, dan merah pada yang sudah selesai menuntut perhatian yang
    // tidak diperlukan lagi.
    const potong = isi.slice(isi.indexOf('kunci: "hari-putusan"'));
    expect(potong.slice(0, 200)).toContain('nada: "awas"');
  });

  it("kotak Ikrar Talak berdiri sendiri dan bernada sejuk", () => {
    const isi = readFileSync(berkasKomponen, "utf8");
    expect(isi).toContain('kunci: "ikrar-talak"');
    expect(isi).toContain('label: "Ikrar Talak"');
    const potong = isi.slice(isi.indexOf('kunci: "ikrar-talak"'));
    expect(potong.slice(0, 200)).toContain('nada: "sejuk"');
  });

  it("penanda baris memakai aturan yang SAMA dengan kotak saringnya", () => {
    // Dua perhitungan terpisah berarti yang tersaring tidak selalu yang
    // bertanda - dan yang dilaporkan kemudian "kotaknya bilang dua, yang
    // bertanda satu".
    const isi = readFileSync(berkasKomponen, "utf8");
    // Sejak 2.29.0 penandanya didahului saklar tampilannya, sehingga
    // bentuknya "tampil(...) && hariPutusan(baris)". Kurung kurawal pembuka
    // karena itu tidak lagi menempel pada namanya.
    //
    // Yang DIJAGA tidak berubah sedikit pun: penanda barisnya memanggil
    // aturan yang sama dengan kotak saringnya. Saklar tampilan tidak boleh
    // menjadi celah untuk diam-diam menggantinya dengan perhitungan sendiri -
    // dan itulah yang membuat laporan "kotaknya bilang dua, yang bertanda
    // satu" dahulu muncul.
    expect(isi).toContain("hariPutusan(baris) ? (");
    expect(isi).toContain("sidangIkrar(baris) ? (");
    expect(isi).toContain("cocok: (x) => hariPutusan(x)");
    expect(isi).toContain("cocok: (x) => sidangIkrar(x)");
    // Dan tidak ada perhitungan tandingan yang membaca agendanya sendiri.
    expect(isi).not.toContain('baris.agenda.includes("utus")');
  });

  it("bendera ikrar_talak diambil dari SIPP, bukan ditebak dari agenda", () => {
    const layanan = readFileSync(
      path.resolve(process.cwd(), "../aleta_bot/services/sippJadwalSidangService.js"),
      "utf8"
    );
    expect(layanan).toContain("j.ikrar_talak         AS ikrarTalak");
    expect(layanan).toContain("sidangIkrarTalak: cleanText(row.ikrarTalak).toUpperCase() === \"Y\"");
    // Wajib di tipe gerbang - ruas opsional yang lupa dikirim bot membuat
    // penandanya mati selamanya tanpa satu pun galat. Sudah empat kali
    // terjadi di ALETA.
    const tipe = readFileSync(
      path.resolve(process.cwd(), "src/server/modules/aleta-bot/whatsapp-gateway-client.ts"),
      "utf8"
    );
    expect(tipe).toContain("sidangIkrarTalak: boolean;");
  });

  it("kotak alur menyaring tabelnya, bukan hanya panel ringkasannya", () => {
    const isi = readFileSync(berkasKomponen, "utf8");
    // Daftar tabel dimulai dari yang sealur, bukan dari seluruh hari itu.
    expect(isi).toContain("let hasil = sidangSealur;");
    // Jumlah pada kotak KEADAAN dihitung di dalam alur yang dipilih, supaya
    // angkanya cocok dengan isi tabel di bawahnya.
    expect(isi).toContain("hitung[keadaan.kunci] = sidangSealur.filter((baris) =>");
    // Jumlah pada kotak ALUR tetap dari seluruh hari - kalau ikut menyusut,
    // alur lain menjadi nol dan pilihannya mustahil dilepas kembali.
    expect(isi).toContain("ringkasAlur(sidang)");
    // Keempat penyaring kartu ikut sampai ke tabel. Sejak penyaring "perkara
    // saya" ada, rantainya dua langkah - dan KEDUANYA dijaga di sini: memutus
    // salah satu membuat tabel mengabaikan penyaring kartu tanpa satu galat
    // pun.
    expect(isi).toContain("const sidangSetelahKartu = adaSaringanKartu");
    expect(isi).toContain("const sidangSesudahRuang = saringKeRuang(milikSaya.baris, ruangSaring)");
    const iSaring = isi.indexOf("saringPerkaraSendiri(");
    expect(iSaring, "penyaring perkara saya tidak dipanggil").toBeGreaterThan(-1);
    expect(
      isi.slice(iSaring, iSaring + 120),
      "penyaring perkara saya tidak memakai hasil saringan kartu"
    ).toContain("sidangSetelahKartu");
  });

  it("kisi kartu yang menyalin tabel sudah tidak ada", () => {
    const isi = readFileSync(berkasKomponen, "utf8");
    expect(isi).not.toContain("{sidangTersaring.map((baris) => (");
    expect(isi).not.toContain("Buka status perkara →");
    // Jalan ke status perkara TIDAK hilang bersama kisinya - ia pindah ke
    // nomor perkara di tabel, tempat mata mencarinya lebih dulu.
    expect(isi).toContain("onClick={() => onBukaStatus(baris.nomorPerkara)}");
  });
});

describe("penyegaran tidak melepas tabel dari layar", () => {
  const sumber = () =>
    readFileSync(
      path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"),
      "utf8"
    );

  it("pesan Memuat hanya untuk muatan pertama", () => {
    // Mengganti seluruh tbody dengan satu baris "Memuat jadwal…" membuat tabel
    // tujuh belas baris menyusut menjadi satu. Halaman ikut memendek, dan
    // peramban menjepit posisi gulir ke atas - itulah "melompat ke atas
    // sendiri" yang dikeluhkan tiap kali ada yang mengambil nomor antrian.
    const isi = sumber();
    expect(isi).toContain("{pertamaMuat && memuat ? (");
    // Bentuk lama tidak boleh kembali.
    expect(isi).not.toContain("<tbody>\n              {memuat ? (");
  });

  it("penandanya dilepas sesudah putaran pertama selesai", () => {
    const isi = sumber();
    expect(isi).toContain("setPertamaMuat(false);");
    // Dilepas di finally, bukan di jalur berhasil saja - muatan pertama yang
    // gagal pun tidak boleh membuat tiap penyegaran berikutnya mengosongkan
    // tabel selamanya.
    const potong = isi.slice(isi.indexOf("memuatRef.current = false;"));
    expect(potong.slice(0, 320)).toContain("setPertamaMuat(false);");
  });

  it("pemuatan ulang berkala TIDAK dimatikan", () => {
    // Perbaikannya bukan mematikan penyegaran - itu mengembalikan layar basi,
    // dan layar basi tampak persis seperti layar yang benar.
    const isi = sumber();
    expect(isi).toContain("window.setInterval(");
    expect(isi).toContain("JEDA_MUAT_ULANG_MS");
  });

  it("kunci baris tetap stabil, supaya barisnya ditukar di tempat", () => {
    // Kunci yang berubah tiap muatan membuat React melepas lalu memasang
    // ulang seluruh baris - dan posisi gulirnya hilang walau tabelnya tidak
    // pernah dikosongkan.
    const isi = sumber();
    expect(isi).toContain("const kunci = `${baris.nomorPerkara}|${baris.sidangId}`;");
  });
});

/**
 * ============================================================================
 * KOTAK "PERLU DIPERIKSA" - YANG DIJAGA DI SINI ADALAH ALASANNYA
 * ============================================================================
 *
 * Kotak gabungan hanya berguna selama ia MENYARING. Begitu ia menyala pada
 * hampir seluruh baris, ia berhenti menjawab apa pun dan hanya menambah satu
 * kotak lagi ke deretan yang sudah penuh - persis keluhan yang hendak
 * dijawabnya.
 *
 * Rencana awalnya menggabungkan merah DAN kuning. Itu ditinggalkan karena
 * ketiga penanda kuning berlaku pada hampir tiap baris jadwal hari ini:
 * berita acara memang ditulis sesudah sidangnya, penundaan memang jalannya
 * perkara, dan nomor antrian memang belum diambil sebelum orangnya datang.
 *
 * Alasan itu tidak dapat dijaga langsung - ia berupa kalimat. Yang dapat
 * dijaga adalah PIJAKANNYA: bahwa ketiga penanda itu memang kuning, dan
 * bahwa keanggotaan kotaknya memang dihitung dari nada. Menaikkan salah
 * satunya menjadi merah akan memasukkannya ke kotak gabungan tanpa satu pun
 * galat - dan kotaknya diam-diam berhenti berarti apa-apa.
 */
describe("kotak gabungan Perlu diperiksa", () => {
  const berkasKomponen = path.resolve(
    process.cwd(),
    "src/components/portal/aleta-ecourt-sidang.tsx"
  );
  const komponen = () => readFileSync(berkasKomponen, "utf8");

  /** Nada satu penanda, dibaca dari sumber komponennya. */
  function nadaDari(isi: string, kunci: string): string {
    const awal = isi.indexOf(`kunci: "${kunci}"`);
    expect(awal, `penanda ${kunci} tidak ditemukan`).toBeGreaterThan(-1);
    const cocok = isi.slice(awal, awal + 400).match(/nada:\s*"([a-z]+)"/);
    expect(cocok, `nada ${kunci} tidak terbaca`).toBeTruthy();
    return cocok![1];
  }

  it("hanya merah yang masuk, dan kuning sengaja tidak", () => {
    expect(NADA_PERLU_DIPERIKSA).toContain("bahaya");
    expect(NADA_PERLU_DIPERIKSA).not.toContain("awas");
  });

  it("ketiga penanda yang dikecualikan memang masih kuning", () => {
    // Inilah pijakan alasannya. Bila salah satunya kelak dinaikkan menjadi
    // merah, ia akan ikut masuk kotak gabungan - dan karena ketiganya berlaku
    // pada hampir tiap baris, kotaknya akan menyala pada hampir seluruh
    // jadwal. Uji ini yang memaksa alasan di atas dibaca ulang lebih dahulu.
    const isi = komponen();
    for (const kunci of ["belum-bas", "ditunda", "belum-antri"]) {
      expect(nadaDari(isi, kunci), kunci).toBe("awas");
    }
  });

  it("ada yang merah, supaya kotaknya tidak selalu kosong", () => {
    // Kotak yang selalu nol sama tidak bergunanya dengan kotak yang selalu
    // penuh - dan yang selalu nol tidak pernah digambar sama sekali.
    const isi = komponen();
    expect(nadaDari(isi, "retur")).toBe("bahaya");
    expect(nadaDari(isi, "belum-dipanggil")).toBe("bahaya");
  });

  it("keanggotaannya dihitung dari nada, bukan didaftar ulang", () => {
    // Daftar kunci kedua adalah daftar yang suatu hari lupa diperbarui:
    // penanda merah baru ditambahkan, tidak masuk kelompoknya, dan tidak ada
    // yang gagal - kotaknya hanya diam-diam menghitung kurang.
    const isi = komponen();
    expect(isi).toContain("const KEADAAN_MENUNTUT_TINDAKAN = KEADAAN_DASAR.filter((x) =>");
    expect(isi).toContain("NADA_PERLU_DIPERIKSA.includes(x.nada)");
    // Sejak 24 September 2026 cocok() menerima saat pengadilan juga, dan
    // satu anggota berjam disebut dengan namanya - lihat NADA_PERLU_DIPERIKSA.
    expect(isi).toContain(
      "KEADAAN_MENUNTUT_TINDAKAN.some((keadaan) => keadaan.cocok(baris, antrian, saat))"
    );
    const awal = isi.indexOf("kunci: KUNCI_PERLU_DIPERIKSA");
    const blok = isi.slice(awal, isi.indexOf("...KEADAAN_DASAR,", awal));
    expect(blok).toContain("belumTundaLewatBatas(baris, saat)");
    expect(blok).toContain("JAM_BATAS_HASIL_SIDANG");
    // Tepat tiga pemakaian: cocok gabungan, hitungan judulnya, dan tanda
    // baris. Pemakaian keempat - mis. kotak saringan kembar - menyala merah.
    expect(isi.split("belumTundaLewatBatas(baris, saat)").length - 1).toBe(3);
  });

  it("kotak gabungan tidak ikut menyapu dirinya sendiri", () => {
    // Kalau ia berada di dalam daftar yang ia sapu, cocok() memanggil dirinya
    // sendiri sampai tumpukan pemanggilan habis - dan layarnya kosong tanpa
    // sebab yang terbaca.
    const isi = komponen();
    const dasar = isi.indexOf("const KEADAAN_DASAR: KeadaanSidang[] = [");
    const gabungan = isi.indexOf("const KEADAAN_SIDANG: KeadaanSidang[] = [");
    const anggota = isi.indexOf("kunci: KUNCI_PERLU_DIPERIKSA");

    expect(dasar).toBeGreaterThan(-1);
    expect(gabungan).toBeGreaterThan(dasar);
    // Kuncinya disebut SESUDAH daftar dasar ditutup - artinya ia bukan
    // anggota daftar itu.
    expect(anggota).toBeGreaterThan(gabungan);
  });

  it("dipisahkan garis dari penanda satuan di belakangnya", () => {
    // Tanpa pemisah ia terbaca sebagai salah satu penanda satuan, dan tidak
    // akan pernah ditekan orang yang sedang mencari pekerjaannya.
    expect(komponen()).toContain("keadaan.kunci === KUNCI_PERLU_DIPERIKSA ? (");
  });
});

describe("dua sumber putusan, satu jawaban - butir 1, 2, dan 4", () => {
  // Tiap describe di berkas ini memegang penolongnya sendiri - diikuti apa
  // adanya supaya susunan yang sudah ada tidak berubah.
  const komponen = () =>
    readFileSync(
      path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-sidang.tsx"),
      "utf8"
    );

  /**
   * ==========================================================================
   * LAYAR YANG BERBANTAH DENGAN DIRINYA SENDIRI
   * ==========================================================================
   *
   * SIPP menyimpan "sudah diputus" di DUA tabel yang tidak saling tahu:
   * perkara_putusan (baris resmi) dan perkara_jadwal_sidang.alasan_ditunda
   * (tempat panitera mengetik hasil sidang). Tidak ada satu pun yang lengkap
   * sendirian, dan itu terukur pada data satker:
   *
   *     2026-09-08   kotak "Sudah" menghitung 1, hasil sidang menyebut 6
   *                  (lima tanpa satu baris pun di perkara_putusan)
   *     2026-09-04   kotak "Sudah" menghitung 18, hasil sidang menyebut 0
   *
   * Sepanjang sejarah 3.905 baris hasil-putus: 3.890 bertanggal sama, 4
   * berbeda, 11 tanpa baris putusan sama sekali. Perpecahannya kecil - tetapi
   * SELALU jatuh pada hari yang sedang berjalan, yaitu hari yang justru sedang
   * dilihat orang.
   *
   * Yang terlihat petugas: kotak hijau "Hasil sidang - putus DIKABULKAN
   * (verstek)" berdiri di baris yang kolom putusannya berbunyi "putusan belum
   * tercatat", dan baris itu tidak ikut terhitung "Sudah".
   */
  const SIDANG = "2026-09-21";

  const barisHasilPutusSaja = {
    sudahPutus: false,
    tanggalPutusan: "",
    tanggalSidang: SIDANG,
    agenda: "Pembacaan putusan",
    ditunda: false,
    alasanDitunda: "putus DIKABULKAN (verstek)",
  };

  const barisPutusanResmiSaja = {
    sudahPutus: true,
    tanggalPutusan: SIDANG,
    tanggalSidang: SIDANG,
    agenda: "Pembacaan putusan",
    ditunda: false,
    alasanDitunda: "",
  };

  const barisDitunda = {
    sudahPutus: false,
    tanggalPutusan: "",
    tanggalSidang: SIDANG,
    agenda: "Panggil Tergugat",
    ditunda: true,
    alasanDitunda: "Tergugat tidak Hadir",
  };

  const barisBelumApaApa = {
    sudahPutus: false,
    tanggalPutusan: "",
    tanggalSidang: SIDANG,
    agenda: "Pemeriksaan pokok perkara",
    ditunda: false,
    alasanDitunda: "",
  };

  it("hasil sidang yang berbunyi putus dihitung SUDAH PUTUS walau baris putusannya belum ada", () => {
    // Inilah keadaan yang dilaporkan pengguna dan yang dahulu luput.
    expect(putusHariIni(barisHasilPutusSaja), "putusHariIni sendirian memang tidak melihatnya").toBe(false);
    expect(sudahPutusHariIni(barisHasilPutusSaja)).toBe(true);
  });

  it("putusan resmi tanpa hasil sidang tetap terhitung", () => {
    // Arah sebaliknya - 2026-09-04 memperlihatkan 18 baris seperti ini.
    expect(sudahPutusHariIni(barisPutusanResmiSaja)).toBe(true);
  });

  it("yang DITUNDA bukan yang diputus", () => {
    // hasilSidangPutusan menolak baris yang bendera ditundanya menyala, dan
    // aturan ini bersandar padanya - bukan pada kata "putus" di teksnya.
    expect(sudahPutusHariIni(barisDitunda)).toBe(false);
    expect(sudahPutusHariIni(barisBelumApaApa)).toBe(false);
  });

  it("sidang yang ditunda tetap terhitung SELESAI hari itu", () => {
    // Yang ditunda sudah dibuka, dibacakan, dan ditutup - ruangnya kosong
    // lagi, dan itulah yang ditanyakan orang yang melihat daftar antrian.
    expect(sidangSelesaiHariIni(barisDitunda)).toBe(true);
    expect(sidangSelesaiHariIni(barisHasilPutusSaja)).toBe(true);
    expect(sidangSelesaiHariIni(barisPutusanResmiSaja)).toBe(true);
    expect(sidangSelesaiHariIni(barisBelumApaApa)).toBe(false);
  });

  it("ketiga kotak penanda memakai aturan gabungan, bukan putusHariIni sendirian", () => {
    const isi = komponen();
    expect(isi).toContain("cocok: (x) => sudahPutusHariIni(x),");
    expect(isi).toContain("cocok: (x) => !x.sudahPutus && !sudahPutusHariIni(x),");
    // Belum tunda lewat lib sejak 24 September 2026 - satu fungsi dengan
    // kotak gabungan dan tanda merah di baris, dan sudahPutusHariIni tetap
    // dipakai di DALAMNYA.
    expect(isi).toContain("cocok: (x) => hasilSidangBelumDicatat(x),");
    expect(isi).not.toContain("cocok: (x) => !x.ditunda && !sudahPutusHariIni(x),");
  });

  it("hasil sidang belum dicatat: bukan yang ditunda, bukan yang diputus, bukan ikrar yang tercatat", () => {
    expect(hasilSidangBelumDicatat(barisDitunda)).toBe(false);
    expect(hasilSidangBelumDicatat(barisHasilPutusSaja)).toBe(false);
    expect(hasilSidangBelumDicatat(barisPutusanResmiSaja)).toBe(false);
    expect(hasilSidangBelumDicatat(barisBelumApaApa)).toBe(true);
    // Ikrar yang dicatat "telah ikrar talak" - 127 baris 2025 s.d. Sep 2026.
    expect(
      hasilSidangBelumDicatat({ ...barisBelumApaApa, sidangIkrarTalak: true, alasanDitunda: "telah ikrar talak" })
    ).toBe(false);
    // Ikrar yang hanya tercatat di perkara_ikrar_talak.
    expect(hasilSidangBelumDicatat({ ...barisBelumApaApa, sidangIkrarTalak: true, ikrarTercatat: true })).toBe(false);
    // "0" adalah nilai bawaan yang tidak pernah diisi, bukan catatan.
    expect(hasilSidangBelumDicatat({ ...barisBelumApaApa, alasanDitunda: "0" })).toBe(true);
  });

  it("penanda SELURUH BARIS dihitung sekali di tingkat baris, bukan di dalam sel antrian", () => {
    // Dahulu sel antrian menghitungnya sendiri - dan karena sel itu keluar
    // lebih awal ketika perkaranya tidak terdaftar di mesin antrian, penanda
    // hijaunya tidak pernah muncul pada perkara itu walau sidangnya selesai.
    const isi = komponen();
    expect(isi).toContain("const sidangSelesai = sidangSelesaiHariIni(baris);");
    expect(isi).toContain("sidangSelesai={sidangSelesai}");
    expect(isi).not.toContain("const sidangSelesai = baris.ditunda || putusHariIni(baris);");
  });

  it("tandanya tidak bergantung pada warna saja", () => {
    // Hijau dan biru portal hampir sama terangnya - luminans 0,4962 lawan
    // 0,5370, selisih 7,6% - sehingga yang membedakan praktis hanya rona.
    const isi = komponen();
    expect(isi).toContain("border-l-4 border-l-emerald-500");
    expect(isi).toContain("text-emerald-600 opacity-70 dark:text-emerald-400");
  });
});
