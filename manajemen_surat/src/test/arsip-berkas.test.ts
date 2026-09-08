// @vitest-environment node
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * BERKAS PINDAIAN ARSIP - DICARI, BUKAN DIBACA DARI BASIS DATA
 * ============================================================================
 *
 * Tabel arsip SIPP TIDAK menyimpan nama berkas sama sekali - diperiksa lewat
 * SHOW COLUMNS: yang ada hanya letak fisik, nomor arsip, tanggal, dan petugas.
 * Karena itu ALETA selama ini menyimpulkan "tidak ada berkas" untuk SELURUH
 * perkara, dan tombol unduhnya tidak pernah muncul sekali pun.
 *
 * Padahal berkasnya ada: 4.128 PDF sebesar 32 GB di dokumen_arsip, disusun
 *
 *   dokumen_arsip/<no_ruang>/<no_lemari>/<no_rak>/<no_berkas>/Arsip_<nomor>.pdf
 *
 * ============================================================================
 * DAN JALUR SUSUNAN SAJA TIDAK CUKUP
 * ============================================================================
 *
 * Letak arsip dapat disunting di SIPP sesudah berkasnya ditulis, dan berkasnya
 * tetap di jalur lama. Diukur: 307 berkas berkeadaan begitu - contohnya
 * 1/Pdt.G/2022 yang di disk ada di lemari "1" sedangkan basis data kini
 * menyebut lemari "X". Tanpa penelusuran nama, ketiga ratus tujuh berkas itu
 * dinyatakan hilang padahal ada.
 */

const require_ = createRequire(import.meta.url);

let akar = "";
let arsip: {
  namaBerkas: (nomor: string) => string;
  jalurSusunan: (baris: Record<string, unknown>) => string;
  cariBerkas: (baris: Record<string, unknown>) => {
    ada: boolean;
    jalur: string;
    jalurSusunan: string;
    cara: string;
    besar: number | null;
    alasan: string;
  };
  lupakanIndeks: () => void;
  akarArsip: () => string;
};

function tulisBerkas(relatif: string, isi = "%PDF-1.4 uji") {
  const penuh = path.join(akar, ...relatif.split("/"));
  mkdirSync(path.dirname(penuh), { recursive: true });
  writeFileSync(penuh, isi);
  return penuh;
}

beforeAll(() => {
  akar = mkdtempSync(path.join(tmpdir(), "aleta-arsip-"));
  // Akar dipasang SEBELUM modulnya dimuat - sippDocumentService membaca env
  // ini sekali saat dimuat.
  process.env.ALETA_BOT_SIPP_DOCUMENT_ROOTS = akar;

  tulisBerkas("dokumen_arsip/I/XII/I/46/Arsip_317_Pdt_G_2026_PA_Dgl.pdf");
  // Berkas yang letaknya sudah disunting: di disk lemari "1", di basis "X".
  tulisBerkas("dokumen_arsip/1/1/1/1/Arsip_1_Pdt_G_2022_PA_Dgl.pdf");

  arsip = require_(
    path.resolve(process.cwd(), "../aleta_bot/services/arsipBerkasService.js")
  );
  arsip.lupakanIndeks();
});

afterAll(() => {
  try {
    rmSync(akar, { recursive: true, force: true });
  } catch {
    // Folder sementara; kegagalannya tidak menggagalkan uji.
  }
});

describe("nama berkas disusun dari nomor perkara", () => {
  it("titik DAN garis miring sama-sama menjadi garis bawah", () => {
    // Inilah yang dipakai SIPP. Mengganti hanya garis miring menghasilkan
    // "Arsip_317_Pdt.G_2026_PA.Dgl.pdf" yang tidak pernah ada.
    expect(arsip.namaBerkas("317/Pdt.G/2026/PA.Dgl")).toBe("Arsip_317_Pdt_G_2026_PA_Dgl.pdf");
  });

  it("nomor kosong tidak menghasilkan nama", () => {
    expect(arsip.namaBerkas("")).toBe("");
  });
});

describe("jalur susunan menuntut letak yang lengkap", () => {
  const utuh = { ruang: "I", lemari: "XII", rak: "I", box: "46", nomorPerkara: "317/Pdt.G/2026/PA.Dgl" };

  it("tersusun bila keempat kepingnya ada", () => {
    expect(arsip.jalurSusunan(utuh)).toBe("dokumen_arsip/I/XII/I/46/Arsip_317_Pdt_G_2026_PA_Dgl.pdf");
  });

  it("kosong bila satu keping saja hilang", () => {
    // Jalur setengah jadi hanya menunjuk folder yang salah, dan menebak
    // kepingan yang hilang lebih buruk daripada mengaku tidak tahu.
    expect(arsip.jalurSusunan({ ...utuh, rak: "" })).toBe("");
  });

  it("keping yang membawa pemisah jalur ditolak", () => {
    // Nilainya datang dari SIPP, bukan peramban - tetapi jalur yang disusun
    // dari isi basis data tetap harus tidak dapat keluar dari foldernya.
    expect(arsip.jalurSusunan({ ...utuh, lemari: "../../etc" })).toBe("");
    expect(arsip.jalurSusunan({ ...utuh, ruang: ".." })).toBe("");
  });
});

describe("mencari berkasnya", () => {
  it("ketemu di letak yang tercatat", () => {
    const hasil = arsip.cariBerkas({
      ruang: "I",
      lemari: "XII",
      rak: "I",
      box: "46",
      nomorPerkara: "317/Pdt.G/2026/PA.Dgl",
    });
    expect(hasil.ada).toBe(true);
    expect(hasil.cara).toBe("letak");
    expect(hasil.jalur).toBe("dokumen_arsip/I/XII/I/46/Arsip_317_Pdt_G_2026_PA_Dgl.pdf");
    expect(hasil.besar).toBeGreaterThan(0);
  });

  it("ketemu lewat nama walau letaknya sudah disunting", () => {
    // Keadaan 307 berkas yang sesungguhnya. Tanpa jalan kedua ini, semuanya
    // dinyatakan hilang dan tombol unduhnya disembunyikan.
    const hasil = arsip.cariBerkas({
      ruang: "1",
      lemari: "X",
      rak: "1",
      box: "1",
      nomorPerkara: "1/Pdt.G/2022/PA.Dgl",
    });
    expect(hasil.ada).toBe(true);
    expect(hasil.cara).toBe("nama");
    expect(hasil.jalur).toBe("dokumen_arsip/1/1/1/1/Arsip_1_Pdt_G_2022_PA_Dgl.pdf");
  });

  it("yang ketemu di luar letaknya MENYEBUTKAN selisihnya", () => {
    // Menemukannya diam-diam berarti membiarkan letaknya selamanya keliru.
    const hasil = arsip.cariBerkas({
      ruang: "1",
      lemari: "X",
      rak: "1",
      box: "1",
      nomorPerkara: "1/Pdt.G/2022/PA.Dgl",
    });
    expect(hasil.alasan).toContain("TIDAK di letak yang tercatat");
    expect(hasil.alasan).toContain("dokumen_arsip/1/X/1/1");
    expect(hasil.jalurSusunan).toBe("dokumen_arsip/1/X/1/1/Arsip_1_Pdt_G_2022_PA_Dgl.pdf");
  });

  it("beda huruf besar-kecil tetap ketemu", () => {
    // Ada satu baris arsip yang nomornya tertulis PA.dgl sedangkan berkasnya
    // PA.Dgl. Pada berkas sistem yang membedakannya, itu saja sudah cukup
    // membuatnya tidak ketemu.
    const hasil = arsip.cariBerkas({
      ruang: "9",
      lemari: "9",
      rak: "9",
      box: "9",
      nomorPerkara: "317/Pdt.G/2026/PA.dgl",
    });
    expect(hasil.ada).toBe(true);
    expect(hasil.cara).toBe("nama");
  });

  it("yang memang tidak ada dinyatakan tidak ada, dengan sebabnya", () => {
    const hasil = arsip.cariBerkas({
      ruang: "I",
      lemari: "I",
      rak: "I",
      box: "1",
      nomorPerkara: "9999/Pdt.G/2026/PA.Dgl",
    });
    expect(hasil.ada).toBe(false);
    expect(hasil.jalur).toBe("");
    expect(hasil.alasan).toContain("belum ada");
  });

  it("nomor perkara kosong tidak dicari sama sekali", () => {
    const hasil = arsip.cariBerkas({ ruang: "I", lemari: "I", rak: "I", box: "1", nomorPerkara: "" });
    expect(hasil.ada).toBe(false);
    expect(hasil.alasan).toContain("Nomor perkara tidak diketahui");
  });
});

describe("daftar jenis berkas tidak boleh berselisih", () => {
  /**
   * Empat tombol unduh mati diam-diam karena daftar ini pernah ada di tiga
   * tempat sekaligus dan hanya dua yang diperbarui.
   *
   * Diuji pada server sebelum diperbaiki - jenis penetapan, arsip, dan petitum
   * sama-sama memulangkan 400 jenis_tidak_dikenali, padahal jalurDokumenSipp
   * sudah lama menangani ketiganya dan layarnya sudah lama memasang tombolnya.
   *
   * Kegagalan macam ini tidak berbunyi: tombolnya tampil, diklik, dan yang
   * terunduh berkas JSON berisi penolakan.
   */
  const berkasLayanan = readFileSync(
    path.resolve(process.cwd(), "../aleta_bot/services/sippJadwalSidangService.js"),
    "utf8"
  );
  const berkasRute = readFileSync(
    path.resolve(process.cwd(), "../aleta_bot/routes/internalGatewayRoutes.js"),
    "utf8"
  );
  const berkasPortal = readFileSync(
    path.resolve(process.cwd(), "src/app/api/aleta-ecourt/berkas-sipp/route.ts"),
    "utf8"
  );

  /** Isi JENIS_BERKAS_SIPP, dibaca dari sumbernya. */
  function daftarBersama(): string[] {
    const blok = berkasLayanan.match(/const JENIS_BERKAS_SIPP = \[([^\]]*)\]/);
    expect(blok, "JENIS_BERKAS_SIPP tidak ditemukan").toBeTruthy();
    return [...(blok as RegExpMatchArray)[1].matchAll(/"([a-z-]+)"/g)].map((m) => m[1]).sort();
  }

  it("tiap cabang jenis pada jalurDokumenSipp terdaftar", () => {
    const cabang = [...berkasLayanan.matchAll(/jenis === "([a-z-]+)"/g)].map((m) => m[1]);
    expect(cabang.length).toBeGreaterThan(5);
    const daftar = daftarBersama();
    for (const j of cabang) expect(daftar, `cabang ${j} tidak terdaftar`).toContain(j);
  });

  it("gerbang bot memakai daftar bersama, bukan daftar tulisan tangan", () => {
    // Inilah akar masalahnya. Daftar tulisan tangan di rute selalu tertinggal
    // dari cabang yang ditambahkan di layanannya.
    expect(berkasRute).toContain("sippJadwalSidangService.JENIS_BERKAS_SIPP.includes(jenis)");
    expect(berkasRute).not.toContain('["dokumen", "relaas", "resi", "bas", "putusan", "putusan-anonim"]');
  });

  it("daftar di portal sama persis dengan daftar bot", () => {
    const blok = berkasPortal.match(/const JENIS_SAH = new Set\(\[([^\]]*)\]/);
    expect(blok, "JENIS_SAH tidak ditemukan").toBeTruthy();
    const portal = [...(blok as RegExpMatchArray)[1].matchAll(/"([a-z-]+)"/g)].map((m) => m[1]).sort();
    expect(portal).toEqual(daftarBersama());
  });
});
