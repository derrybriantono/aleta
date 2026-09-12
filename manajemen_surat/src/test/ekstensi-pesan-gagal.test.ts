// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * KEGAGALAN SAMBUNGAN HARUS MENYEBUT SEBABNYA - DAN APA YANG MASIH JALAN
 * ============================================================================
 *
 * Yang tergambar sebelumnya bunyi mentah: "Failed to fetch", "ALETA menjawab
 * 502", "Gagal menghubungi ALETA". Ketiganya benar dan ketiganya menuntun ke
 * kesimpulan yang sama di kepala petugas: ekstensinya rusak. Lalu panelnya
 * ditutup - padahal yang mati satu bagian, sedangkan tema, panel, penjaga
 * CETAK, sunting variabel ABT, pembersih keterangan saksi, dan CETAK rtf
 * beserta anonimnya tidak pernah menyentuh ALETA sama sekali.
 *
 * Ujinya MENJALANKAN ketiga fungsi dari panel-alat.js - berkas yang sungguh
 * dikirim ke peramban - bukan menyalinnya ke sini.
 */

const berkasAlat = path.resolve(process.cwd(), "../ekstensi-sipp/panel-alat.js");
const berkasKonten = path.resolve(process.cwd(), "../ekstensi-sipp/konten.js");
const berkasAbt = path.resolve(process.cwd(), "../ekstensi-sipp/abt.js");
const berkasManifest = path.resolve(process.cwd(), "../ekstensi-sipp/manifest.json");

interface Alat {
  alatSebabGagal: (galat: unknown, status?: number) => string;
  alatPesanGagal: (galat: unknown, status?: number, yangDiminta?: string) => string;
  alatAmbil: (alamat: string, opsi?: unknown, yangDiminta?: string) => Promise<unknown>;
}

/**
 * Mengambil ketiganya apa adanya dari panel-alat.js.
 *
 * fetch disuntikkan sebagai parameter supaya kegagalan sambungan dapat
 * dipalsukan tanpa menyentuh fetch global milik proses uji.
 */
function ambilAlat(fetchPalsu: unknown): Alat {
  const isi = readFileSync(berkasAlat, "utf8").replace(/\r\n/g, "\n");
  const a = isi.indexOf("function alatSebabGagal(");
  const penutup = "throw new Error(alatPesanGagal(galat, 0, yangDiminta));\n  }\n}";
  const b = isi.indexOf(penutup, a);
  if (a < 0 || b < 0) throw new Error("ketiga fungsi tidak ditemukan di panel-alat.js");
  const sumber = isi.slice(a, b + penutup.length);

  const buat = new Function(
    "fetch",
    `${sumber}\nreturn { alatSebabGagal, alatPesanGagal, alatAmbil };`
  ) as (f: unknown) => Alat;
  return buat(fetchPalsu);
}

const alat = ambilAlat(() => Promise.reject(new TypeError("Failed to fetch")));

describe("sebab kegagalan dibedakan", () => {
  it("401 dan 403 berarti belum masuk, bukan server mati", () => {
    // Bedanya penting: yang satu diperbaiki petugas sendiri dalam sepuluh
    // detik, yang lain tidak dapat diperbaikinya sama sekali.
    expect(alat.alatSebabGagal(null, 401)).toBe("masuk");
    expect(alat.alatSebabGagal(null, 403)).toBe("masuk");
  });

  it("502/503/504 dan 5xx lain berarti server mati", () => {
    for (const status of [500, 502, 503, 504, 599]) {
      expect(alat.alatSebabGagal(null, status), String(status)).toBe("mati");
    }
  });

  it("status lain berarti jawabannya yang tidak diduga", () => {
    expect(alat.alatSebabGagal(null, 418)).toBe("jawaban");
    expect(alat.alatSebabGagal(null, 404)).toBe("jawaban");
  });

  it("TypeError dari fetch berarti permintaannya tidak pernah sampai", () => {
    // Peramban tidak membedakan server mati, jaringan putus, dan alamat tak
    // terjangkau - dan memang tidak dapat. Ketiganya digolongkan sama.
    expect(alat.alatSebabGagal(new TypeError("Failed to fetch"), 0)).toBe("mati");
    expect(alat.alatSebabGagal(new TypeError("NetworkError when attempting to fetch resource"))).toBe(
      "mati"
    );
    expect(alat.alatSebabGagal(new TypeError("Load failed"), 0)).toBe("mati");
  });

  it("yang tidak dikenali tidak dipaksa masuk golongan", () => {
    expect(alat.alatSebabGagal(new Error("gagal mengurai JSON"), 0)).toBe("lain");
  });
});

describe("kalimat yang menggantikan bunyi mentah", () => {
  it("server mati menyebutkan yang TETAP jalan tanpanya", () => {
    const pesan = alat.alatPesanGagal(new TypeError("Failed to fetch"), 0, "Merapikan posita");

    expect(pesan).toContain("Merapikan posita gagal");
    expect(pesan).toContain("tidak terjangkau");
    // Inilah inti perbaikannya - daftar yang membuat petugas tidak menutup
    // panelnya. Tanpa ini kalimatnya kembali menjadi "gagal" yang lebih sopan.
    expect(pesan).toContain("TETAP jalan");
    expect(pesan).toContain("sunting variabel ABT");
    expect(pesan).toContain("keterangan saksi");
    // Dan yang memang menunggu server, supaya tidak dicoba berulang-ulang.
    expect(pesan).toContain("menunggu ALETA");
    expect(pesan).toContain("PDF");
  });

  it("belum masuk portal menyebutkan jalan keluarnya", () => {
    const pesan = alat.alatPesanGagal(null, 401, "Membaca usulan");

    expect(pesan).toContain("Membaca usulan gagal");
    expect(pesan).toContain("belum masuk portal ALETA");
    // Menyegarkan halaman SIPP membuang pekerjaan yang sedang diketik, dan
    // memang tidak diperlukan - panel membaca cookie pada permintaan
    // berikutnya. Petugas perlu diberi tahu itu, bukan dibiarkan menebak.
    expect(pesan).toContain("tidak perlu menyegarkan halaman ini");
  });

  it("jawaban tak diduga menyebutkan angkanya untuk dilaporkan", () => {
    const pesan = alat.alatPesanGagal(null, 418, "Membuat PDF");
    expect(pesan).toContain("Membuat PDF gagal");
    expect(pesan).toContain("418");
  });

  it("tanpa nama pekerjaan kalimatnya tetap utuh", () => {
    expect(alat.alatPesanGagal(null, 503)).toContain("Permintaan gagal");
  });

  it("sebab yang tidak terbaca tidak menghasilkan kalimat kosong", () => {
    expect(alat.alatPesanGagal(null, 0, "Menyambung kata")).toContain("tidak terbaca");
  });
});

describe("alatAmbil menyalin kalimat itu ke tiap pemanggil", () => {
  it("kegagalan sambungan dilempar sebagai kalimat, bukan TypeError", async () => {
    // Inilah sebab hampir seluruh pemanggil tidak perlu diubah: catch yang
    // sudah menampilkan galat.message ikut membaik dengan sendirinya.
    await expect(alat.alatAmbil("/aleta/api/apa-pun", {}, "Merapikan posita")).rejects.toThrow(
      // [\s\S] alih-alih bendera /s: sasaran tsc proyek ini belum es2018.
      /Merapikan posita gagal[\s\S]*TETAP jalan/
    );
  });

  it("jawaban yang sampai diteruskan apa adanya, sekalipun 500", async () => {
    // alatAmbil BUKAN penjaga status. Yang ditangkapnya hanya permintaan yang
    // tidak pernah sampai - status diperiksa pemanggilnya, yang tahu arti
    // 403 pada rutenya sendiri.
    const alatLain = ambilAlat(() => Promise.resolve({ ok: false, status: 500 }));
    const jawab = (await alatLain.alatAmbil("/aleta/api/apa-pun", {}, "Uji")) as {
      status: number;
    };
    expect(jawab.status).toBe(500);
  });
});

describe("kedua halaman memakai satu sumber kalimat", () => {
  const manifest = () => JSON.parse(readFileSync(berkasManifest, "utf8"));

  it("panel-alat.js dimuat di SIPP sebelum konten.js", () => {
    // Urutannya bukan selera: keduanya berbagi satu lingkup, dan fungsi yang
    // dipanggil sebelum berkasnya dijalankan tidak ada.
    const daftar = manifest().content_scripts as Array<{ js?: string[] }>;
    const sipp = daftar.find((x) => (x.js || []).includes("konten.js"));
    expect(sipp, "entri SIPP").toBeTruthy();
    const js = sipp!.js || [];
    expect(js.indexOf("panel-alat.js")).toBeGreaterThanOrEqual(0);
    expect(js.indexOf("panel-alat.js")).toBeLessThan(js.indexOf("konten.js"));
  });

  it("panel-alat.js dimuat di ABT sebelum abt.js", () => {
    const daftar = manifest().content_scripts as Array<{ js?: string[] }>;
    const abt = daftar.find((x) => (x.js || []).includes("abt.js"));
    expect(abt, "entri ABT").toBeTruthy();
    const js = abt!.js || [];
    expect(js.indexOf("panel-alat.js")).toBeLessThan(js.indexOf("abt.js"));
  });

  it("kalimatnya ditulis sekali saja, tidak disalin ke kedua berkas", () => {
    // Salinan kedua berarti daftar "yang tetap jalan" yang separuhnya usang,
    // dan tidak ada yang tahu bagian mana. Itu justru yang hendak dihindari.
    for (const berkas of [berkasKonten, berkasAbt]) {
      const isi = readFileSync(berkas, "utf8");
      expect(isi, path.basename(berkas)).not.toContain("function alatPesanGagal");
      expect(isi, path.basename(berkas)).not.toContain("function alatSebabGagal");
    }
  });
});

describe("bunyi mentah tidak tertinggal di jalur yang dilihat petugas", () => {
  const konten = () => readFileSync(berkasKonten, "utf8");

  it("tidak ada lagi kalimat mentah di konten.js", () => {
    const isi = konten();
    expect(isi).not.toContain("Gagal menghubungi ALETA");
    expect(isi).not.toContain("ALETA menjawab ${respons.status}");
    expect(isi).not.toContain("Server menjawab ${respons.status}");
  });

  it("permintaan yang berbicara ke petugas melewati alatAmbil", () => {
    const isi = konten();
    const lewatAlat = isi.split("await alatAmbil(").length - 1;
    const mentah = isi.split("await fetch(").length - 1;

    // 19 sejak berkas gugatan dapat dibaca dari arsip ALETA - berkas yang
    // tidak ada di arsip harus berbunyi sebagai kalimat beserta jalan
    // keluarnya, bukan sebagai kode 404.
    // (18 sejak pembatalan menyeluruh ditambahkan - satu permintaan lagi yang
    // berbicara ke petugas. Penetapan massal TIDAK menambah: ia memakai
    // rantai penetapan dan pembaca usulan yang sudah ada.
    // (17 sejak tab Riwayat ALETA ditambahkan - riwayat yang gagal terbaca
    // harus berbunyi sebagai kalimat, bukan sebagai kode status.
    // (16 sejak pembatalan penetapan ditambahkan - satu permintaan lagi yang
    // berbicara ke petugas, dan karena itu wajib melewati alatAmbil.
    // (15 sejak usulan alasan perkara pada layar Data Umum, 14 sejak usulan
    // medan pilihan pada formulir putusan, 13 sejak "Isi formulir putusan dari
    // ALETA", 12 sejak "Tetapkan lewat ALETA".)
    expect(lewatAlat).toBe(19);

    // ==========================================================================
    // LIMA YANG SENGAJA DIBIARKAN MENTAH - DAN SEBABNYA SATU PER SATU
    // ==========================================================================
    //
    // Kelimanya tidak menampilkan apa pun ketika gagal, atas keputusan yang
    // sudah tertulis di tempatnya masing-masing:
    //
    //   tutupTitipan          penerusannya tetap terbuka, dapat ditutup dari
    //                         daftar - petugas tidak perlu diberi tahu
    //   pemeriksa versi       panel tetap utuh tanpa pemberitahuan
    //   penanda daftar massal halaman daftar berjalan seperti biasa
    //   sisipkanPermintaan    hanya membaca keadaan; tombolnya tidak digambar
    //   penyisip panel        SIPP berjalan seperti biasa bila ALETA mati -
    //                         panel yang berteriak di TIAP halaman SIPP justru
    //                         yang membuat ekstensinya dimatikan
    //
    // Angka ini menjaga keputusan itu tetap sadar: permintaan ALETA yang baru
    // dan mentah menaikkannya, dan penulisnya harus memilih - dilewatkan
    // alatAmbil, atau ditambahkan ke daftar di atas beserta alasannya.
    expect(mentah).toBe(5);
  });
});
