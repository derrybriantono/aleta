// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

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
// ---------------------------------------------------------------------------

const AGENDA_ELITIGASI = [
  /\bjawaban\b/i,
  /\breplik\b/i,
  /\bduplik\b/i,
  /duplik\s+rekonvensi/i,
  /\bkesimpulan\b/i,
  /musyawarah\s+majelis/i,
  /pembacaan\s+(putusan|penetapan)/i,
  /putusan\s+sela/i,
];

function agendaElitigasi(agenda: string): boolean {
  const teks = String(agenda || "");
  if (!teks) return false;
  return AGENDA_ELITIGASI.some((pola) => pola.test(teks));
}

function sidangElitigasi(baris: { agenda?: string; lewatEcourt?: boolean }): boolean {
  if (!baris.lewatEcourt) return false;
  return agendaElitigasi(baris.agenda || "");
}

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
// PENJAGA YANG MEMBACA BERKAS SUMBERNYA, BUKAN SALINANNYA
// ---------------------------------------------------------------------------

describe("aturan di komponen benar-benar sama dengan salinan di uji ini", () => {
  /**
   * ==========================================================================
   * KENAPA PENJAGA INI ADA
   * ==========================================================================
   *
   * Seluruh uji di atas bekerja atas SALINAN aturan, bukan atas komponennya.
   * Salinan itu memang disengaja - komponennya tiga ribu baris dan tidak dapat
   * dirender di lingkungan node - tetapi ia punya lubang yang sudah terbukti
   * memakan korban:
   *
   *   AGENDA_ELITIGASI di komponen pernah memuat aksara BACKSPACE (0x08)
   *   alih-alih escape \b, karena heredoc Bash menelan tanda miringnya saat
   *   berkas itu ditulis. Regexnya menjadi /<BS>jawaban<BS>/i - yang tidak
   *   pernah cocok dengan teks apa pun.
   *
   *   Saringan e-Litigasi karena itu MATI TOTAL: tidak satu pun sidang pernah
   *   tertandai. Tidak ada galat, tidak ada peringatan, dan uji di atas tetap
   *   hijau seluruhnya - karena ia menguji salinan yang ejaannya benar.
   *
   * Penjaga ini menutup lubang itu dengan membaca berkas komponennya dan
   * memeriksa dua hal yang dapat diperiksa tanpa merender apa pun.
   */

  const berkasKomponen = path.resolve(
    process.cwd(),
    "src/components/portal/aleta-ecourt-sidang.tsx"
  );

  it("tidak ada aksara kendali liar di berkas komponen", () => {
    const isi = readFileSync(berkasKomponen, "utf8");
    // Tab, LF, dan CR sah. Sisanya di bawah 0x20 tidak pernah sengaja diketik
    // ke dalam berkas TSX - kehadirannya berarti escape yang tertelan.
    const liar: string[] = [];
    isi.split("\n").forEach((baris, nomor) => {
      for (const aksara of baris) {
        const kode = aksara.charCodeAt(0);
        if (kode < 32 && kode !== 9 && kode !== 13) {
          liar.push(`baris ${nomor + 1}: U+${kode.toString(16).padStart(4, "0")}`);
        }
      }
    });
    expect(liar, `aksara kendali liar ditemukan: ${liar.join(", ")}`).toEqual([]);
  });

  it("tiap pola di salinan uji benar-benar ada di komponen", () => {
    const isi = readFileSync(berkasKomponen, "utf8");
    // Sumbernya ditulis apa adanya, sehingga /\bjawaban\b/i di komponen
    // muncul sebagai teks itu juga. Kalau salinan di atas diubah tanpa
    // mengubah komponennya - atau sebaliknya - uji ini gagal.
    for (const pola of AGENDA_ELITIGASI) {
      expect(isi, `pola ${pola} tidak ada di komponen`).toContain(pola.source);
    }
  });

  it("komponen menuntut lewatEcourt, bukan agenda saja", () => {
    const isi = readFileSync(berkasKomponen, "utf8");
    // Kalau syarat e-Court dihapus dari komponen, penanda e-Litigasi kembali
    // menandai perkara biasa - dan tidak ada gejala yang terlihat.
    expect(isi).toContain("function sidangElitigasi");
    expect(isi).toContain("if (!baris.lewatEcourt) return false;");
  });
});

// ---------------------------------------------------------------------------
// Salinan aturan warna dan pengenalan verzet - lihat penjaga di atas.
// ---------------------------------------------------------------------------

function warnaStatusPutusan(status: string): string {
  const teks = String(status || "").toLowerCase();
  if (!teks) return "muted";
  if (/tidak\s+dapat\s+diterima/.test(teks)) return "warning";
  if (/dikabulkan|perdamaian|damai/.test(teks)) return "success";
  if (/tolak/.test(teks)) return "danger";
  if (/gugur/.test(teks)) return "warning";
  if (/cabut|dicoret/.test(teks)) return "muted";
  return "outline";
}

function perkaraVerzetDari(...teks: Array<string | undefined | null>): boolean {
  return /verzet|perlawanan/i.test(teks.filter(Boolean).join(" "));
}

describe("warna penanda mengikuti status putusan", () => {
  it("tujuh status yang benar-benar dipakai PA Donggala", () => {
    // Diambil dari tabel status_putusan SIPP, bukan daftar yang dikarang -
    // id 62, 63, 64, 65, 66, 67, 85, 93 dan 7 adalah yang benar-benar muncul
    // pada perkara_putusan di PA Donggala.
    expect(warnaStatusPutusan("Dikabulkan")).toBe("success");
    expect(warnaStatusPutusan("Dikabulkan Sebagian")).toBe("success");
    expect(warnaStatusPutusan("Perdamaian")).toBe("success");
    expect(warnaStatusPutusan("Ditolak")).toBe("danger");
    expect(warnaStatusPutusan("Digugurkan")).toBe("warning");
    expect(warnaStatusPutusan("Gugur")).toBe("warning");
    expect(warnaStatusPutusan("Dicabut")).toBe("muted");
    expect(warnaStatusPutusan("Dicoret dari Register")).toBe("muted");
  });

  it("Tidak Dapat Diterima TIDAK merah - ia bukan kekalahan", () => {
    // Syarat formalnya belum terpenuhi, dan perkaranya boleh diajukan kembali
    // sesudah diperbaiki. Mewarnainya merah menyamakan dua keadaan yang
    // akibatnya berbeda bagi pihak yang membacanya.
    expect(warnaStatusPutusan("Tidak Dapat Diterima")).toBe("warning");
  });

  it("status di luar daftar tetap ditampilkan, tidak disembunyikan", () => {
    // Status baru yang ditambahkan operator SIPP harus tetap terbaca meski
    // warnanya belum ditentukan.
    expect(warnaStatusPutusan("Mengabulkan Eksepsi")).toBe("outline");
  });

  it("status kosong netral, bukan hijau", () => {
    // Hijau pada status yang belum tercatat terbaca sebagai kabar baik atas
    // sesuatu yang belum diketahui.
    expect(warnaStatusPutusan("")).toBe("muted");
  });
});

describe("verzet dikenali dari jenis perkaranya", () => {
  it("dua sebutan yang dipakai SIPP dan sehari-hari", () => {
    expect(perkaraVerzetDari("Perlawanan (Verzet)")).toBe(true);
    expect(perkaraVerzetDari("Verzet")).toBe(true);
    expect(perkaraVerzetDari("Perlawanan")).toBe(true);
  });

  it("kumulasi ikut diperiksa, bukan hanya jenis utamanya", () => {
    expect(perkaraVerzetDari("Cerai Gugat", "Perlawanan")).toBe(true);
  });

  it("perkara biasa tidak tertandai", () => {
    expect(perkaraVerzetDari("Cerai Gugat", "")).toBe(false);
    expect(perkaraVerzetDari("Cerai Talak")).toBe(false);
    expect(perkaraVerzetDari(undefined, null)).toBe(false);
  });
});

describe("aturan warna dan verzet di komponen sama dengan salinan di atas", () => {
  const berkasKomponen = path.resolve(
    process.cwd(),
    "src/components/portal/aleta-ecourt-sidang.tsx"
  );

  it("fungsinya ada, dan satu - bukan dua salinan yang dapat menyimpang", () => {
    const isi = readFileSync(berkasKomponen, "utf8");
    // warnaStatusPutusan PINDAH ke @/lib/warna-putusan begitu layar Status
    // Perkara ikut mewarnai status yang sama. Yang dijaga tetap sama - satu
    // aturan, bukan dua - hanya tempatnya yang berubah: sekarang dijaga
    // dengan menuntut IMPOR dan melarang salinan lokal.
    expect(isi).toContain('from "@/lib/warna-putusan"');
    expect(isi).not.toContain("function warnaStatusPutusan");
    expect(isi).toContain("function perkaraVerzetDari");
    // Aturan verzet pernah ditulis dua kali di berkas ini. Dua salinan akan
    // sama-sama bekerja, lalu pada suatu hari satu layar menandai perkara yang
    // tidak ditandai layar lain - untuk perkara yang persis sama.
    expect(isi.split("/verzet|perlawanan/i").length - 1).toBe(1);
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

/** Salinan AGENDA_MUSYAWARAH dari aleta-ecourt-sidang.tsx. */
const AGENDA_MUSYAWARAH = [
  /musyawarah/i,
  /pembacaan\s+(putusan|penetapan)/i,
  /\bputusan\b/i,
  /\bpenetapan\b/i,
];

function agendaMusyawarah(agenda: string): boolean {
  const teks = String(agenda || "");
  if (!teks) return false;
  return AGENDA_MUSYAWARAH.some((pola) => pola.test(teks));
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

  it("penanda musyawarah bernada bahaya, bukan sejuk", () => {
    const isi = readFileSync(berkasKomponen, "utf8");
    expect(isi).toContain('kunci: "musyawarah-majelis"');
    expect(isi).toContain('label: "Musyawarah Majelis"');
    // Kotak lama yang bernada sejuk sudah diganti, bukan ditambahi kotak kedua.
    expect(isi).not.toContain('kunci: "agenda-putusan"');
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
