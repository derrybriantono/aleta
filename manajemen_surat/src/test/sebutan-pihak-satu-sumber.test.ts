// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  perkaraPermohonan,
  sebutanPihakPerkara,
  sebutanSatuPihak,
} from "@/lib/sebutan-pihak";

/**
 * ============================================================================
 * SATU SUMBER KEBENARAN UNTUK SEBUTAN PARA PIHAK
 * ============================================================================
 *
 * Sampai 23 September 2026 ada sebelas penurun sebutan dengan tujuh aturan
 * berbeda. Diukur atas seluruh 10.120 perkara sipp_donggala, dibandingkan
 * dengan kueri ABT untuk variabel #0046# (yang memakai alur_perkara_id dan
 * jenis_perkara_id, bukan kata):
 *
 *   kelengkapanDataService        salah 5.254 (51,9% seluruh perkara)
 *   caseDirectoryService          salah 5.581 (55,1%)
 *   penyusunPertimbanganService   salah 4.415 (43,6%)
 *   isian-putusan-sipp            salah 3.999 (39,5%)
 *   jlf-variable-resolver         salah 1.178 (11,6%)
 *
 *   aturan baru, memakai nomor    salah     0 (0,0%)
 *   aturan baru, cadangan kata    salah    92 (0,9%)
 *
 * Yang dijaga di sini BUKAN angka itu, melainkan hal-hal yang membuatnya
 * salah - dan seluruhnya gagal tanpa satu pun galat.
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(akar, jalur), "utf8").replace(/\r\n/g, "\n");

/**
 * Nama jenis perkara yang SUNGGUH ada di perkara.jenis_perkara_nama satker
 * ini, beserta jumlahnya dan sebutan yang benar menurut kueri ABT.
 *
 * Bukan ejaan karangan. Uji lama memakai "Itsbat Nikah" - bentuk yang tidak
 * pernah ada satu baris pun di basis data - sehingga ujinya hijau selama
 * 3.972 perkara nyata dijawab salah.
 */
const NAMA_NYATA: Array<{ nama: string; n: number; satu: string; dua: string }> = [
  { nama: "Pengesahan Perkawinan/Istbat Nikah", n: 3885, satu: "Pemohon", dua: "Termohon" },
  { nama: "Cerai Talak", n: 1166, satu: "Pemohon", dua: "Termohon" },
  { nama: "Dispensasi Kawin", n: 198, satu: "Pemohon", dua: "Termohon" },
  { nama: "P3HP/Penetapan Ahli Waris", n: 102, satu: "Pemohon", dua: "Termohon" },
  { nama: "Perwalian", n: 91, satu: "Pemohon", dua: "Termohon" },
  { nama: "Istbat Nikah", n: 87, satu: "Pemohon", dua: "Termohon" },
  { nama: "Wali Adhol", n: 13, satu: "Pemohon", dua: "Termohon" },
  { nama: "Asal Usul Anak", n: 13, satu: "Pemohon", dua: "Termohon" },
  { nama: "Izin Poligami", n: 12, satu: "Pemohon", dua: "Termohon" },
  { nama: "Pencegahan Perkawinan", n: 2, satu: "Pemohon", dua: "Termohon" },
  { nama: "Penolakan Perkawinan", n: 1, satu: "Pemohon", dua: "Termohon" },
  { nama: "Cerai Gugat", n: 4300, satu: "Penggugat", dua: "Tergugat" },
];

describe("ejaan SIPP yang sesungguhnya, bukan ejaan yang benar menurut kamus", () => {
  for (const { nama, n, satu, dua } of NAMA_NYATA) {
    it(`"${nama}" (${n} perkara) -> ${satu}/${dua}`, () => {
      const hasil = sebutanPihakPerkara({ jenisPerkaraNama: nama });
      expect(hasil.satu).toBe(satu);
      expect(hasil.dua).toBe(dua);
    });
  }

  it("ketiga ejaan istbat dikenali - satu huruf meleset membuang 3.972 perkara", () => {
    for (const ejaan of ["Istbat Nikah", "Itsbat Nikah", "Isbat Nikah"]) {
      expect(perkaraPermohonan({ jenisPerkaraNama: ejaan }), ejaan).toBe(true);
    }
  });

  it("Adhol dan Adhal sama-sama dikenali - SIPP menulis yang pertama", () => {
    expect(perkaraPermohonan({ jenisPerkaraNama: "Wali Adhol" })).toBe(true);
    expect(perkaraPermohonan({ jenisPerkaraNama: "Wali Adhal" })).toBe(true);
  });
});

describe("nomor lebih dipercaya daripada kata", () => {
  it("cerai talak bernomor Pdt.G tetap bersebutan Pemohon", () => {
    // 1.166 perkara di satker ini. Inilah sebab menebak dari nomor perkara
    // selalu salah, dan sebab jlf-variable-resolver salah pada 1.178 perkara.
    const hasil = sebutanPihakPerkara({
      alurPerkaraId: 15,
      jenisPerkaraId: 346,
      jenisPerkaraNama: "Cerai Talak",
      nomorPerkara: "0001/Pdt.G/2015/PA.Dgl",
    });
    expect(hasil.satu).toBe("Pemohon");
    expect(hasil.sumber).toBe("jenis");
  });

  it("izin poligami juga - 12 perkara, dan tidak satu pun tertangkap nomornya", () => {
    expect(
      sebutanPihakPerkara({ alurPerkaraId: 15, jenisPerkaraId: 341 }).satu
    ).toBe("Pemohon");
  });

  it("nomor perkara MENANG atas kata ketika keduanya ada dan berbeda", () => {
    // 79 perkara bernama "Pengesahan Perkawinan/Istbat Nikah" ternyata
    // beralur GUGATAN menurut SIPP - istbat yang dilawan pihak lain. Nomornya
    // yang benar; namanya menyesatkan, dan persis begitulah cadangan kata
    // seharusnya kalah.
    const hasil = sebutanPihakPerkara({
      alurPerkaraId: 15,
      jenisPerkaraId: 999,
      jenisPerkaraNama: "Pengesahan Perkawinan/Istbat Nikah",
    });
    expect(hasil.satu).toBe("Penggugat");
    expect(hasil.sumber).toBe("alur");
  });

  it("alur permohonan menang tanpa melihat namanya sama sekali", () => {
    const hasil = sebutanPihakPerkara({ alurPerkaraId: 16, jenisPerkaraNama: "Cerai Gugat" });
    expect(hasil.satu).toBe("Pemohon");
    expect(hasil.sumber).toBe("alur");
  });

  it("jinayat punya sebutannya sendiri dan tidak pernah tertukar dengan perdata", () => {
    for (const alur of [122, 123]) {
      const hasil = sebutanPihakPerkara({ alurPerkaraId: alur });
      expect(hasil.satu).toBe("Penuntut Umum");
      expect(hasil.dua).toBe("Terdakwa");
    }
  });
});

describe("kedudukan pihak dan kuasanya", () => {
  it("pihak kedua memakai sebutan kedua", () => {
    expect(sebutanSatuPihak(2, { jenisPerkaraNama: "Cerai Talak" })).toBe("Termohon");
    expect(sebutanSatuPihak("T", { jenisPerkaraNama: "Cerai Gugat" })).toBe("Tergugat");
  });

  it("kuasa hukum memakai sebutan yang diwakilinya", () => {
    expect(sebutanSatuPihak(1, { jenisPerkaraNama: "Cerai Talak" }, "kuasa")).toBe("Kuasa Pemohon");
  });

  it("kedudukan yang tidak dikenali dianggap pihak pertama", () => {
    expect(sebutanSatuPihak(null, { jenisPerkaraNama: "Cerai Gugat" })).toBe("Penggugat");
  });
});

describe("tanpa keterangan apa pun, jawabannya tetap dapat dipakai", () => {
  it("gugatan menjadi bawaan, dan sumbernya dikatakan", () => {
    const hasil = sebutanPihakPerkara({});
    expect(hasil.satu).toBe("Penggugat");
    expect(hasil.sumber).toBe("bawaan");
  });

  it("nomor Pdt.P tetap dibaca ketika namanya tidak ada", () => {
    const hasil = sebutanPihakPerkara({ nomorPerkara: "220/Pdt.P/2026/PA.Dgl" });
    expect(hasil.satu).toBe("Pemohon");
    expect(hasil.sumber).toBe("nomor");
  });
});

describe("kembaran bot dan portal tidak boleh berbeda", () => {
  const ts = baca("manajemen_surat/src/lib/sebutan-pihak.ts");
  const js = baca("aleta_bot/services/sebutanPihakService.js");

  it("polanya sama persis, huruf demi huruf", () => {
    // Bot tidak dapat memuat TypeScript dan portal tidak dapat memuat
    // CommonJS, jadi aturannya memang ditulis dua kali. Yang tidak boleh
    // adalah keduanya menyimpang - dan penyimpangan pola regex tidak pernah
    // menghasilkan galat, hanya jawaban yang berbeda di dua layar.
    const ambil = (teks: string) => {
      const i = teks.indexOf("POLA_PERMOHONAN =");
      expect(i).toBeGreaterThan(-1);
      return teks.slice(teks.indexOf("/", i), teks.indexOf(";", i));
    };
    expect(ambil(js)).toBe(ambil(ts));
  });

  it("nomor alur dan jenisnya sama", () => {
    for (const potongan of ["ALUR_PERMOHONAN = 16", "[122, 123]", "[346, 341]"]) {
      expect(ts, `TS: ${potongan}`).toContain(potongan);
      expect(js, `JS: ${potongan}`).toContain(potongan);
    }
  });
});

describe("penurun lama sudah tidak berdiri sendiri lagi", () => {
  it("kelengkapanDataService memakai sumber bersama", () => {
    const teks = baca("aleta_bot/services/kelengkapanDataService.js");
    expect(teks).toContain("sebutanPihakService.sebutanSatuPihak(");
    // Pola lama menuntut "itsbat" sedangkan SIPP menulis "Istbat".
    expect(teks, "pola lama masih ada").not.toContain("permohonan|itsbat|dispensasi|wali|poligami");
  });

  it("caseDirectoryService berhenti membandingkan dengan satu kata persis", () => {
    const teks = baca("aleta_bot/services/caseDirectoryService.js");
    // Tidak satu pun dari 10.120 perkara punya jenis_perkara_nama yang
    // berbunyi persis "Permohonan", jadi cabang itu tidak pernah berjalan.
    //
    // Yang diperiksa ISI FUNGSINYA, bukan seluruh berkas - keterangan di atas
    // fungsi menyebut bentuk lamanya, dan penjaga yang menyisir seluruh
    // berkas akan menangkap keterangan itu sendiri lalu merah atas kode yang
    // sudah betul.
    const i = teks.indexOf("function describeRole(");
    expect(i).toBeGreaterThan(-1);
    const badan = teks.slice(i, teks.indexOf("\n}", i));
    expect(badan).not.toContain('=== "Permohonan"');
    expect(badan).toContain("sebutanPihakService.sebutanSatuPihak(");
  });

  it("penyusunPertimbanganService membaca alur dan jenis dari SIPP", () => {
    const teks = baca("aleta_bot/services/penyusunPertimbanganService.js");
    expect(teks).toContain("p.alur_perkara_id AS alurPerkaraId");
    expect(teks).toContain("p.jenis_perkara_id AS jenisPerkaraId");
    expect(teks).not.toContain("/talak|permohonan|Pdt\\.P/i");
  });

  it("jlf-variable-resolver berhenti menebak dari nomor perkara", () => {
    const teks = baca(
      "manajemen_surat/src/server/modules/judicia/legal-form/documents/jlf-variable-resolver-service.ts"
    );
    expect(teks).toContain("sebutanKonteks(context, caseType)");
    expect(teks).not.toContain('context.nomorPerkara.includes("/Pdt.P/") ? "Pemohon" : "Penggugat"');
  });

  it("isian-putusan-sipp memakai sumber bersama", () => {
    const teks = baca("manajemen_surat/src/lib/isian-putusan-sipp.ts");
    expect(teks).toContain("sebutanSatuPihak(");
    expect(teks).not.toContain("wali\\s*adhal|poligami");
  });
});
