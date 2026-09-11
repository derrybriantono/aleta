// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  anonimkanAmar,
  sebutanPihak,
  susunIsianPutusanSipp,
} from "@/lib/isian-putusan-sipp";
import {
  kepalaPutusan,
  naskahDariKerangka,
  pecahNaskahPutusan,
  susunKerangka,
} from "@/lib/susunan-putusan";

/**
 * Isian borang Putusan Akhir SIPP.
 *
 * Yang dijaga di sini hal-hal yang berakibat pada dokumen resmi:
 *
 *   1. NASKAH DIPECAH TEPAT. Pertimbangan dan amar masuk ke dua isian yang
 *      berbeda di SIPP. Salah potong berarti amar tertulis di kolom
 *      pertimbangan - dan itu tersimpan, tercetak, lalu dibagikan.
 *   2. HALANGAN BUKAN ISI. Bagian yang belum terisi ditulis perakit sebagai
 *      "[sebab]". Memasukkannya ke borang berarti menulis alasan ke dalam
 *      putusan.
 *   3. NAMA BENAR-BENAR TERSAMAR pada amar anonim, termasuk ketika satu nama
 *      merupakan bagian dari nama yang lain.
 *   4. YANG TIDAK TERSAMAR DIAKUI. Anonimisasi yang menyatakan dirinya
 *      lengkap padahal tidak adalah cara paling rapi menerbitkan nama orang.
 */

const PIHAK = [
  { nama: "SITI AMINAH", pihakKe: 1, jenis: "pihak" },
  { nama: "BUDI SANTOSO", pihakKe: 2, jenis: "pihak" },
];

function naskahLengkap(pertimbangan: string, amar: string) {
  return naskahDariKerangka(
    susunKerangka({
      kepala: kepalaPutusan({ nomorPerkara: "10/Pdt.G/2026/PA.Dgl", pengadilan: "PENGADILAN AGAMA DONGGALA" }),
      identitas: { isi: "SITI AMINAH melawan BUDI SANTOSO" },
      dudukPerkara: { isi: "Menimbang bahwa perkara ini terdaftar pada 1 September 2026." },
      pertimbangan: { isi: pertimbangan },
      amar: { isi: amar },
      penutup: { isi: "Demikian diputus pada hari Senin." },
    })
  );
}

describe("memecah naskah putusan kembali menjadi bagiannya", () => {
  it("memulangkan tiap bagian pada kuncinya sendiri", () => {
    const naskah = naskahLengkap("Menimbang bahwa gugatan beralasan.", "MENGADILI: Mengabulkan gugatan Penggugat.");
    const bagian = pecahNaskahPutusan(naskah);

    expect(bagian.pertimbangan).toBe("Menimbang bahwa gugatan beralasan.");
    expect(bagian.amar).toBe("MENGADILI: Mengabulkan gugatan Penggugat.");
    expect(bagian.penutup).toBe("Demikian diputus pada hari Senin.");
    expect(bagian.kepala).toContain("Nomor 10/Pdt.G/2026/PA.Dgl");
  });

  it("bagian yang belum terisi dipulangkan KOSONG, bukan berisi sebabnya", () => {
    // naskahDariKerangka menulis "[Amar putusan belum terisi.]" untuk bagian
    // kosong. Kalimat itu keterangan, bukan amar.
    const naskah = naskahLengkap("Menimbang bahwa gugatan beralasan.", "");
    const bagian = pecahNaskahPutusan(naskah);
    expect(bagian.amar).toBe("");
    expect(bagian.pertimbangan).toBe("Menimbang bahwa gugatan beralasan.");
  });

  it("isi berbaris banyak tetap utuh, termasuk baris kosong di tengahnya", () => {
    const amar = "MENGADILI:\n\n1. Mengabulkan gugatan Penggugat;\n2. Menghukum Tergugat membayar biaya.";
    const bagian = pecahNaskahPutusan(naskahLengkap("Menimbang.", amar));
    expect(bagian.amar).toBe(amar);
  });

  it("naskah kosong atau tanpa judul yang dikenal memulangkan kosong", () => {
    expect(pecahNaskahPutusan("")).toEqual({});
    expect(pecahNaskahPutusan("   ")).toEqual({});
    expect(pecahNaskahPutusan("sekadar tulisan tanpa judul bagian")).toEqual({});
  });

  it("judul yang hanya menjadi bagian kalimat TIDAK dianggap penanda bagian", () => {
    // "AMAR PUTUSAN" di tengah kalimat bukan judul; hanya baris yang seluruhnya
    // berisi judul itu yang memulai bagian baru.
    const naskah = naskahLengkap("Menimbang bahwa AMAR PUTUSAN sebelumnya keliru.", "MENGADILI: menolak.");
    const bagian = pecahNaskahPutusan(naskah);
    expect(bagian.pertimbangan).toContain("AMAR PUTUSAN sebelumnya keliru");
    expect(bagian.amar).toBe("MENGADILI: menolak.");
  });
});

describe("sebutan pihak mengikuti jenis perkaranya", () => {
  it("gugatan memakai Penggugat dan Tergugat", () => {
    expect(sebutanPihak(1, "Cerai Gugat")).toBe("Penggugat");
    expect(sebutanPihak(2, "Cerai Gugat")).toBe("Tergugat");
  });

  it("permohonan memakai Pemohon dan Termohon", () => {
    expect(sebutanPihak(1, "Itsbat Nikah")).toBe("Pemohon");
    expect(sebutanPihak(2, "Dispensasi Kawin")).toBe("Termohon");
    expect(sebutanPihak(1, "Cerai Talak")).toBe("Pemohon");
  });

  it("kuasa disebut kuasa", () => {
    expect(sebutanPihak(1, "Cerai Gugat", "kuasa")).toBe("Kuasa Penggugat");
  });

  it("kedudukan yang tidak diketahui dianggap pihak pertama", () => {
    expect(sebutanPihak(null, "Cerai Gugat")).toBe("Penggugat");
  });
});

describe("amar anonim", () => {
  it("mengganti nama pihak dengan sebutan acaranya", () => {
    const { teks, diganti } = anonimkanAmar(
      "Mengabulkan gugatan SITI AMINAH dan menghukum BUDI SANTOSO membayar biaya.",
      PIHAK,
      "Cerai Gugat"
    );
    expect(teks).toBe("Mengabulkan gugatan Penggugat dan menghukum Tergugat membayar biaya.");
    expect(diganti).toEqual([
      { nama: "BUDI SANTOSO", menjadi: "Tergugat" },
      { nama: "SITI AMINAH", menjadi: "Penggugat" },
    ]);
  });

  it("nama yang menjadi bagian nama lain tidak menyisakan potongan", () => {
    // Bila "SITI" diganti lebih dulu, "AMINAH" tertinggal - dan yang
    // tertinggal justru bagian yang paling mengenali orangnya.
    const { teks } = anonimkanAmar("Menetapkan SITI AMINAH sebagai ahli waris, bukan SITI.", [
      { nama: "SITI", pihakKe: 2, jenis: "pihak" },
      { nama: "SITI AMINAH", pihakKe: 1, jenis: "pihak" },
    ], "Permohonan Penetapan Ahli Waris");
    expect(teks).toBe("Menetapkan Pemohon sebagai ahli waris, bukan Termohon.");
    expect(teks).not.toContain("AMINAH");
  });

  it("tidak menyentuh kata lain yang kebetulan memuat nama itu", () => {
    const { teks } = anonimkanAmar("Menghukum BUDI SANTOSO, bukan BUDIMAN.", PIHAK, "Cerai Gugat");
    expect(teks).toContain("BUDIMAN");
    expect(teks).toContain("Tergugat,");
  });

  it("huruf besar-kecil tidak menghalangi penggantian", () => {
    const { teks } = anonimkanAmar("Gugatan Siti Aminah dikabulkan.", PIHAK, "Cerai Gugat");
    expect(teks).toBe("Gugatan Penggugat dikabulkan.");
  });

  it("nama yang terlalu pendek diabaikan - penggantiannya lebih berbahaya daripada gunanya", () => {
    const { diganti } = anonimkanAmar("Menghukum AB membayar biaya.", [{ nama: "AB", pihakKe: 2 }], "Cerai Gugat");
    expect(diganti).toEqual([]);
  });

  it("amar kosong memulangkan kosong, tanpa melempar", () => {
    expect(anonimkanAmar("", PIHAK)).toEqual({ teks: "", diganti: [] });
  });
});

describe("usulan isian borang SIPP", () => {
  const naskah = naskahLengkap(
    "Menimbang bahwa rumah tangga SITI AMINAH dan BUDI SANTOSO tidak dapat dirukunkan.",
    "MENGADILI:\n1. Mengabulkan gugatan SITI AMINAH;\n2. Menjatuhkan talak satu bain sughra BUDI SANTOSO."
  );

  it("memisahkan pertimbangan, amar, dan amar anonim", () => {
    const isian = susunIsianPutusanSipp({ naskah, pihak: PIHAK, jenisPerkara: "Cerai Gugat", keadaanDraf: "ditandatangani" });
    expect(isian.pertimbangan).toContain("tidak dapat dirukunkan");
    expect(isian.amar).toContain("Mengabulkan gugatan SITI AMINAH");
    expect(isian.amarAnonim).toContain("Mengabulkan gugatan Penggugat");
    expect(isian.amarAnonim).not.toContain("SITI AMINAH");
    expect(isian.amarAnonim).not.toContain("BUDI SANTOSO");
    expect(isian.belumTerisi).toEqual([]);
  });

  it("pertimbangan TIDAK ikut disamarkan - yang anonim hanya amarnya", () => {
    // SIPP hanya punya satu isian anonim, dan isinya amar. Menyamarkan
    // pertimbangan berarti menyimpan pertimbangan yang berbeda dari yang
    // ditandatangani.
    const isian = susunIsianPutusanSipp({ naskah, pihak: PIHAK, jenisPerkara: "Cerai Gugat" });
    expect(isian.pertimbangan).toContain("SITI AMINAH");
  });

  it("menyebut bagian wajib yang masih kosong, dan tidak menambalnya", () => {
    const isian = susunIsianPutusanSipp({
      naskah: naskahLengkap("", "MENGADILI: menolak."),
      pihak: PIHAK,
      jenisPerkara: "Cerai Gugat",
    });
    expect(isian.pertimbangan).toBe("");
    expect(isian.belumTerisi).toEqual(["Pertimbangan hukum"]);
  });

  it("draf yang belum ditandatangani disebut keadaannya", () => {
    const isian = susunIsianPutusanSipp({ naskah, pihak: PIHAK, jenisPerkara: "Cerai Gugat", keadaanDraf: "draf" });
    expect(isian.catatan.join(" ")).toContain("belum ditandatangani");
  });

  it("selalu mengingatkan bahwa Simpan tidak ditekan ALETA", () => {
    const isian = susunIsianPutusanSipp({ naskah, pihak: PIHAK, jenisPerkara: "Cerai Gugat" });
    expect(isian.catatan.join(" ")).toContain("tidak ditekan ALETA");
  });

  it("mengakui bila tidak satu pun nama ditemukan di amar", () => {
    const isian = susunIsianPutusanSipp({
      naskah: naskahLengkap("Menimbang.", "MENGADILI: menolak gugatan."),
      pihak: PIHAK,
      jenisPerkara: "Cerai Gugat",
    });
    expect(isian.namaDisamarkan).toEqual([]);
    expect(isian.catatan.join(" ")).toContain("Tidak satu pun nama pihak ditemukan");
  });

  it("menyebutkan bahwa saksi, anak, alamat, dan nomor identitas tidak ikut tersamar", () => {
    const isian = susunIsianPutusanSipp({ naskah, pihak: PIHAK, jenisPerkara: "Cerai Gugat" });
    expect(isian.catatan.join(" ")).toContain("TIDAK ikut tersamar");
  });
});
