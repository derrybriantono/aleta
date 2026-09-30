// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * BUNYI GALAT ABT TIDAK BOLEH TERCETAK SEBAGAI PERTIMBANGAN HUKUM
 * ============================================================================
 *
 * Yang dijaga di sini satu keadaan yang tidak menimbulkan galat apa pun ketika
 * terjadi: variabel yang isinya BUKAN keterangan melainkan pesan mesin, lolos
 * dari pemeriksaan kelengkapan, lalu ikut tercetak di dalam putusan.
 *
 * Sebabnya bentuk pemeriksaannya yang lama:
 *
 *   ISI_KOSONG = /^(DATA_TIDAK_ADA|TIDAK BENAR QUERY NYA|BELUM ISI|-)?$/i
 *
 * Ia BERJANGKAR di kedua ujung, sedangkan bunyi galat ABT panjang - "TIDAK
 * BENAR QUERY NYA / BELUM ISI ALASAN DI KOLOM ABT". Yang berjangkar tidak
 * pernah cocok dengan yang panjang, jadi kalimat itu digolongkan "terisi", dan
 * yang terisi tidak pernah ditanyakan kepada siapa pun.
 *
 * Ujinya MENJALANKAN keadaanNilai dari abt.js, bukan membaca sumbernya. Uji
 * sumber hanya membuktikan hurufnya masih ada; yang perlu dibuktikan di sini
 * adalah putusannya - dan putusan itulah yang dulu salah.
 */

const berkasAbt = path.resolve(process.cwd(), "../ekstensi-sipp/abt.js");

/** Memotong satu bagian sumber, dari penanda pembuka sampai penutupnya. */
function potong(isi: string, buka: string, tutup: string): string {
  const a = isi.indexOf(buka);
  if (a < 0) throw new Error(`penanda pembuka tidak ditemukan: ${buka}`);
  const b = isi.indexOf(tutup, a);
  if (b < 0) throw new Error(`penanda penutup tidak ditemukan: ${tutup}`);
  return isi.slice(a, b + tutup.length);
}

type Keadaan = "kosong" | "galat" | "terisi";

/**
 * Mengambil keadaanNilai apa adanya dari abt.js dan menjalankannya.
 *
 * abt.js adalah content script - ia menyentuh document, chrome, dan halaman
 * ABT. Memuat seluruhnya di node menuntut memalsukan semua itu. Yang diambil
 * karena itu hanya potongan yang murni: dua daftar dan satu fungsi yang tidak
 * menyentuh apa pun di luar keduanya.
 */
function ambilKeadaanNilai(): (nilai: unknown) => Keadaan {
  const isi = readFileSync(berkasAbt, "utf8").replace(/\r\n/g, "\n");
  const sumber = potong(isi, "const NILAI_KOSONG = new Set(", 'return "terisi";\n}');
  const buat = new Function(`${sumber}\nreturn keadaanNilai;`) as () => (n: unknown) => Keadaan;
  return buat();
}

const keadaanNilai = ambilKeadaanNilai();

/**
 * Aturan LAMA, disalin apa adanya - satu-satunya gunanya membuktikan bahwa
 * perbaikannya memang mengubah sesuatu. Bila kelak ia dihapus dari sini, yang
 * hilang bukan penjagaan melainkan buktinya.
 */
const ISI_KOSONG_LAMA = /^(DATA_TIDAK_ADA|TIDAK BENAR QUERY NYA|BELUM ISI|-)?$/i;

describe("keadaan satu nilai variabel ABT", () => {
  it("bunyi error ABT yang sesungguhnya digolongkan error", () => {
    // Kalimat ini disalin dari layar ABT, bukan dikarang: itulah yang
    // dikeluarkan cabang ELSE kueri data_sql pada 4020 dan sejenisnya.
    const nyata = "TIDAK BENAR QUERY NYA / BELUM ISI ALASAN DI KOLOM ABT";

    expect(keadaanNilai(nyata)).toBe("galat");

    // Dan inilah lubangnya: aturan lama melewatkannya sama sekali.
    expect(ISI_KOSONG_LAMA.test(nyata)).toBe(false);
  });

  it("frasanya tertangkap di mana pun letaknya dalam kalimat", () => {
    // Tidak berjangkar - sebab ABT menempelkan bunyi galat di tengah kalimat
    // yang lebih panjang, dan panjangnya berubah-ubah menurut variabelnya.
    expect(keadaanNilai("Alasan: TIDAK BENAR QUERY NYA, periksa kolomnya")).toBe("galat");
    expect(keadaanNilai("belum isi alasan di kolom abt")).toBe("galat");
    expect(keadaanNilai("  TIDAK BENAR   QUERY  NYA  ")).toBe("galat");
  });

  it("bunyi kosong menurut ABT sendiri digolongkan kosong", () => {
    for (const nilai of ["", "-", "0", "...", "DATA_TIDAK_ADA", "TIDAK_BISA_LOAD"]) {
      expect(keadaanNilai(nilai), nilai || "(kosong)").toBe("kosong");
    }
    expect(keadaanNilai(null)).toBe("kosong");
    expect(keadaanNilai(undefined)).toBe("kosong");
    expect(keadaanNilai("   ")).toBe("kosong");
    // Huruf kecil pun sama - ABT tidak ajek soal ini.
    expect(keadaanNilai("data_tidak_ada")).toBe("kosong");
  });

  it("keterangan yang sah tidak ikut tertangkap", () => {
    // Frasanya sengaja dipilih panjang. "BELUM ISI" saja terlalu pendek: ia
    // dapat muncul di dalam keterangan yang sungguh ditulis orang, dan
    // penjaga yang menahan keterangan sah lebih merusak daripada tidak ada.
    expect(keadaanNilai("Penggugat belum isi formulir gugatan")).toBe("terisi");
    expect(keadaanNilai("Bahwa Tergugat sering mabuk")).toBe("terisi");
    expect(keadaanNilai("0 kali")).toBe("terisi");
    expect(keadaanNilai("-1")).toBe("terisi");
  });
});

describe("pemeriksaan kelengkapan memakai keadaan itu", () => {
  const sumber = () => readFileSync(berkasAbt, "utf8");

  it("error disapu atas SELURUH baris yang tergambar", () => {
    // Dulu hanya lima nomor di VAR_OTOMATIS yang diperiksa - tambalan per
    // variabel. Variabel turunan lain yang bunyinya sedikit berbeda lolos.
    const isi = sumber();
    expect(isi).toContain("for (const [kode, item] of peta) {");
    expect(isi).toContain('if (keadaanNilai(item.nilai) === "galat") rusak.push(');
  });

  it("kosong hanya disapu atas kerangka faktanya", () => {
    // Menyapu seluruh baris akan menahan hampir tiap pencetakan: 8523 dan
    // 8524 memang kosong pada perkara yang tidak memerlukannya, dan penjaga
    // yang selalu berbunyi berhenti dibaca.
    const isi = sumber();
    expect(isi).toContain("for (const kode of VARIABEL_SASARAN) {");
    expect(isi).toContain('if (keadaanNilai(item.nilai) === "kosong") kurang.push(');
  });

  it("aturan lama tidak lagi dipakai kode mana pun", () => {
    // Dua aturan untuk satu pertanyaan berarti satu di antaranya akan lupa
    // diperbarui - dan yang lupa itu yang dipakai saat mencetak.
    //
    // Yang dijaga PEMAKAIANNYA, bukan hurufnya. Namanya masih disebut dua
    // kali di dalam komentar, dan memang harus: di situlah tercatat bahwa
    // aturan itu pernah ada, apa lubangnya, dan kenapa diganti. Menghapus
    // catatan itu berarti orang berikutnya menemukan aturan berjangkar yang
    // sama sebagai "penyederhanaan" dan membukanya kembali.
    const isi = sumber();
    expect(isi).not.toContain("const ISI_KOSONG");
    expect(isi).not.toContain("ISI_KOSONG.test(");
  });
});
