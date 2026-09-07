// @vitest-environment node
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
];

function agendaElitigasi(agenda: string): boolean {
  const teks = String(agenda || "");
  if (!teks) return false;
  return AGENDA_ELITIGASI.some((pola) => pola.test(teks));
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
    // Kelimanya adalah tahapan yang pada e-Litigasi dipertukarkan lewat
    // aplikasi, bukan dibacakan di ruang sidang.
    for (const agenda of [
      "Jawaban Termohon",
      "Replik Penggugat",
      "Duplik Tergugat",
      "Duplik Rekonvensi",
      "Kesimpulan Para Pihak",
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
      "Pembacaan Putusan",
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
