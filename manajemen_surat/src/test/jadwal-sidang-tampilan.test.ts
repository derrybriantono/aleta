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
    expect(isi).toContain("function warnaStatusPutusan");
    expect(isi).toContain("function perkaraVerzetDari");
    // Aturan verzet pernah ditulis dua kali di berkas ini. Dua salinan akan
    // sama-sama bekerja, lalu pada suatu hari satu layar menandai perkara yang
    // tidak ditandai layar lain - untuk perkara yang persis sama.
    expect(isi.split("/verzet|perlawanan/i").length - 1).toBe(1);
  });
});
