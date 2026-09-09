// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * BAB 1 KATALOG e-AUDIT - MESIN YANG MENGUKUR DIRINYA SENDIRI
 * ============================================================================
 *
 * Sebelas bab katalog e-Audit mengukur pengadilan. Bab 1 mengukur MESINNYA:
 * apakah ada periode tujuh jendela, apakah tiap angka dapat dibuka menjadi
 * buktinya, apakah nilai berpenyebut terlalu kecil ditahan.
 *
 * Kemampuan semacam itu bukan penilaian, sehingga tidak ada kunci penilaian
 * untuk ditunjuk - dan selama sambungan hanya berbentuk SAMBUNGAN, keenam
 * butirnya jatuh ke "belum" bukan karena belum ada, melainkan karena tidak
 * ada tempat menyebutkannya. Papan e-Audit karena itu MENGECILKAN dirinya:
 * tertulis 0 dari 6, padahal empat di antaranya sudah tertanam sebagai
 * kontrak yang ditegakkan saat pendaftaran - kerangkaPenilaianService bahkan
 * menyebut nomor butirnya di kepala berkasnya sendiri.
 *
 * ============================================================================
 * YANG PALING PENTING DIJAGA DI SINI: PEMERIKSANYA HARUS BISA GAGAL
 * ============================================================================
 *
 * Aturan katalog sejak semula - keadaan DIHITUNG, bukan ditulis - tidak boleh
 * dilanggar hanya karena yang diperiksa kali ini mesinnya sendiri. Pemeriksaan
 * yang selalu hijau bukan pemeriksaan; ia pengakuan yang ditulis dengan cara
 * yang lebih panjang.
 *
 * Karena itu tiap kemampuan dibuktikan dengan MENJALANKANNYA - dan uji ini
 * ikut membuktikan bahwa pemeriksanya sungguh dapat menjawab tidak.
 */

const require_ = createRequire(import.meta.url);
const akarBot = path.resolve(process.cwd(), "../aleta_bot");

type Hasil = { kunci: string; terpenuhi: boolean; bukti?: string; sebab?: string };

const mesin = require_(path.join(akarBot, "services/kemampuanMesinService.js")) as {
  PEMERIKSA: Record<string, () => unknown>;
  periksaSemua: () => Hasil[];
  terpenuhi: () => string[];
};

const katalog = require_(path.join(akarBot, "services/katalogEAuditService.js")) as {
  KEMAMPUAN: Record<string, { kemampuan: string; sifat: string; catatan: string }>;
  keadaan: (
    terdaftar: string[],
    kemampuan?: string[]
  ) => {
    perButir: Array<{ kode: string; bab: number; keadaan: string; kunci: string | null }>;
    penuh: number;
    putus: number;
  };
  celaKatalog: () => unknown[];
};

const berkas = require_(path.join(akarBot, "services/berkasPengawasanService.js")) as {
  BAGIAN_WAJIB: string[];
  celaBerkas: (b: unknown) => string[];
};

const periode = require_(path.join(akarBot, "services/periodePenilaianService.js")) as {
  CUKUP_PENYEBUT: number;
  nilaiDenganPembatas: (a: number, b: number) => { nilai: number | null; cukup: boolean };
};

const kerangka = require_(path.join(akarBot, "services/kerangkaPenilaianService.js")) as {
  celaDefinisi: (def: unknown) => string[];
};

describe("keenam kemampuan Bab 1 benar-benar ada", () => {
  it("seluruhnya terpenuhi saat dijalankan", () => {
    const hasil = mesin.periksaSemua();
    const gagal = hasil.filter((x) => !x.terpenuhi);
    const laporan = gagal.map((x) => `${x.kunci}: ${x.sebab}`).join("\n");
    expect(laporan, laporan || "seluruhnya terpenuhi").toBe("");
    expect(hasil).toHaveLength(6);
  });

  it("tiap kemampuan membawa buktinya, bukan sekadar kata ya", () => {
    // Bukti kosong berarti pemeriksanya tidak benar-benar memeriksa apa pun -
    // dan yang membacanya tidak punya cara mengetahui itu.
    for (const satu of mesin.periksaSemua()) {
      expect(String(satu.bukti || "").trim().length, satu.kunci).toBeGreaterThan(10);
    }
  });
});

describe("pemeriksanya sungguh dapat menjawab tidak", () => {
  it("pembatas penyebut memang menahan yang di bawah ambang", () => {
    // Ini isi pemeriksaan MS05, dijalankan langsung: kalau baris ini pernah
    // berubah sehingga penyebut 19 menghasilkan nilai, pemeriksanya gagal -
    // dan itu memang yang seharusnya terjadi.
    const batas = periode.CUKUP_PENYEBUT;
    expect(batas).toBeGreaterThanOrEqual(20);
    expect(periode.nilaiDenganPembatas(10, batas - 1).nilai).toBeNull();
    expect(periode.nilaiDenganPembatas(10, batas).nilai).not.toBeNull();
  });

  it("penilaian tanpa bukti memang ditolak", () => {
    // Isi pemeriksaan MS04. Angka tanpa bukti tidak dapat dipertanggung-
    // jawabkan, dan penolakan inilah yang menegakkannya.
    const cela = kerangka.celaDefinisi({
      kunci: "ujiTanpaBukti",
      judul: "Uji",
      keterangan: "Uji",
      lantai: "harian",
      versiRumus: "uji-1",
      caraHitung: "uji",
      hitung: () => ({ nilai: 0 }),
    });
    expect(cela.some((x) => String(x).includes("baris()"))).toBe(true);
  });
});

describe("katalog menyambungkan Bab 1 tanpa melanggar aturannya sendiri", () => {
  it("keenam butirnya penuh ketika kemampuannya terbukti", () => {
    const k = katalog.keadaan([], mesin.terpenuhi());
    const bab1 = k.perButir.filter((x) => x.bab === 1);
    expect(bab1).toHaveLength(6);
    for (const b of bab1) expect(b.keadaan, b.kode).toBe("penuh");
  });

  it("kemampuan yang TIDAK terbukti menjadi temuan, bukan diam-diam belum", () => {
    // Inilah yang membuat sambungan ini tetap jujur. Kalau kemampuan yang
    // disandari lenyap, butirnya harus BERTERIAK - sama seperti sambungan yang
    // menunjuk penilaian tidak terdaftar. Menjadikannya "belum" akan
    // menyembunyikan kemunduran sebagai pekerjaan yang belum dimulai.
    const k = katalog.keadaan([], []);
    const bab1 = k.perButir.filter((x) => x.bab === 1);
    for (const b of bab1) expect(b.keadaan, b.kode).toBe("putus");
  });

  it("keadaan Bab 1 tidak ditulis tangan di mana pun", () => {
    // Nama kemampuan boleh ditulis; keadaannya tidak. Yang menentukan
    // "penuh" adalah daftar kemampuan terbukti yang dioper pemanggilnya.
    const isi = readFileSync(path.join(akarBot, "services/katalogEAuditService.js"), "utf8");
    expect(isi).toContain("const mampu = new Set((kemampuanTerpenuhi || []).map(String));");
    expect(isi).toContain('keadaan: "putus"');
  });

  it("katalog tetap tanpa cela", () => {
    expect(katalog.celaKatalog()).toEqual([]);
  });

  it("rute gerbang benar-benar mengoper kemampuannya", () => {
    // Tanpa baris ini di rute, seluruh perbaikan ini tidak sampai ke layar -
    // dan Bab 1 tetap terbaca nol dari enam.
    const isi = readFileSync(path.join(akarBot, "routes/internalGatewayRoutes.js"), "utf8");
    expect(isi).toContain("katalogEAuditService.keadaan(terdaftar, kemampuan)");
    expect(isi).toContain("kemampuanMesinService.terpenuhi()");
  });
});

describe("MS06 - berkas pengawasan menolak yang tidak lengkap", () => {
  const utuh = {
    penilaian: { kunci: "uji", versiRumus: "1" },
    periode: { jenis: "bulanan" },
    nilai: { angka: 80 },
    bukti: [],
    temuan: [],
    aturan: { sidik: "a=1;b=2" },
    tanggalHitung: "2026-09-09T00:00:00.000Z",
  };

  it("berkas utuh diterima", () => {
    expect(berkas.celaBerkas(utuh)).toEqual([]);
  });

  it("tiap bagian wajib benar-benar diwajibkan", () => {
    // Berkas pengawasan yang kurang satu bagian lebih berbahaya daripada
    // tidak ada: yang menerimanya tidak tahu bagian mana yang hilang.
    for (const bagian of berkas.BAGIAN_WAJIB) {
      const kurang: Record<string, unknown> = { ...utuh };
      delete kurang[bagian];
      const cela = berkas.celaBerkas(kurang);
      expect(cela.length, `tanpa ${bagian}`).toBeGreaterThan(0);
      expect(cela.join(" "), `tanpa ${bagian}`).toContain(bagian);
    }
  });

  it("aturan tanpa sidik ditolak", () => {
    // Nilai 82 yang dihitung dengan ambang tiga hari bukan nilai yang sama
    // dengan 82 yang dihitung dengan ambang lima hari. Berkas yang tidak
    // menyebutkan ambangnya tidak dapat dipertahankan ketika ambangnya
    // kelak berubah.
    const cela = berkas.celaBerkas({ ...utuh, aturan: { sidik: "" } });
    expect(cela.join(" ")).toContain("sidik");
  });

  it("versi rumus wajib disebut", () => {
    // Tanpa versi rumus, perubahan angka tidak dapat dibedakan antara
    // "datanya berubah" dan "cara menghitungnya berubah".
    const cela = berkas.celaBerkas({ ...utuh, penilaian: { kunci: "uji", versiRumus: "" } });
    expect(cela.join(" ")).toContain("versi rumus");
  });
});
