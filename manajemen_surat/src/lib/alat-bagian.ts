/**
 * ============================================================================
 * DAFTAR BAGIAN YANG HIDUP, DAN ABA-ABA UNTUK SELURUHNYA
 * ============================================================================
 *
 * Status Perkara memuat dua puluh tujuh bagian yang masing-masing menyimpan
 * keadaan ciutnya sendiri di peramban. Tiga hal yang diminta satker menuntut
 * SELURUHNYA disentuh sekaligus - buka semua, tutup semua, dan loncat ke satu
 * bagian - dan tidak satu pun dapat dikerjakan dari luar tanpa jalan seperti
 * ini.
 *
 * ============================================================================
 * KENAPA BUKAN KEADAAN REACT DI KOMPONEN INDUK
 * ============================================================================
 *
 * Menaikkan keadaan ciut ke induk akan membuat SELURUH layar digambar ulang
 * tiap kali satu bagian dibuka - dua puluh tujuh bagian, sebagiannya memuat
 * tabel beratus baris. Yang sekarang: tiap bagian memegang keadaannya sendiri,
 * dan aba-aba ini hanya menyentuh yang perlu.
 *
 * ============================================================================
 * PENDAFTARANNYA UNTUK PINTASAN, BUKAN UNTUK KEADAAN
 * ============================================================================
 *
 * Daftar di bawah menyimpan JUDUL tiap bagian yang sedang hidup, supaya bilah
 * pintasan dapat menyusun dirinya sendiri. Ia tidak menyimpan keadaan ciut -
 * itu tetap milik peramban, dan tetap milik tiap bagian.
 */

export type BagianTerdaftar = { kunci: string; judul: string };

const terdaftar = new Map<string, string>();
const pendengarDaftar = new Set<() => void>();
const pendengarAba = new Set<(aba: Aba) => void>();

export type Aba =
  | { jenis: "buka-semua" }
  | { jenis: "tutup-semua" }
  | { jenis: "buka"; kunci: string }
  /**
   * Meminta SATU analisis lanjutan dibuka.
   *
   * Dipakai kartu identitas pihak: yang sedang menatap nama seseorang ingin
   * langsung melihat perkara lain orang itu. Analisisnya sudah ada sejak lama
   * - yang tidak ada JALANNYA, dan tanpa jalan itu ia harus menutup kartunya,
   * menggulung ke Analisis lanjutan, lalu mencari satu tombol di antara empat
   * puluh satu.
   *
   * Lewat aba-aba, bukan lewat keadaan yang dinaikkan ke induk: menaikkannya
   * berarti seluruh layar digambar ulang tiap kali satu analisis dipilih.
   */
  | { jenis: "analisa"; kunci: string };

/** Kunci penyimpanan keadaan ciut - satu bentuk, dipakai bersama. */
export function kunciCiut(kunci: string) {
  return `aleta.status-perkara.ciut.${kunci}`;
}

export function daftarkanBagian(kunci: string, judul: string) {
  if (!kunci) return () => {};
  terdaftar.set(kunci, judul);
  for (const f of pendengarDaftar) f();
  return () => {
    terdaftar.delete(kunci);
    for (const f of pendengarDaftar) f();
  };
}

export function bacaDaftarBagian(): BagianTerdaftar[] {
  return [...terdaftar.entries()].map(([kunci, judul]) => ({ kunci, judul }));
}

export function langgananDaftar(f: () => void) {
  pendengarDaftar.add(f);
  // Dibungkus supaya pemulangnya void - React menolak pembersih yang
  // memulangkan nilai, dan Set.delete memulangkan boolean.
  return () => {
    pendengarDaftar.delete(f);
  };
}

export function langgananAba(f: (aba: Aba) => void) {
  pendengarAba.add(f);
  return () => {
    pendengarAba.delete(f);
  };
}

/**
 * Menyiarkan aba-aba, DAN menuliskan keadaannya ke peramban lebih dahulu.
 *
 * Urutannya disengaja. Bagian yang sedang tidak tergambar - karena induknya
 * belum menggambarnya - tidak akan mendengar aba-abanya; yang membuatnya tetap
 * terbuka sesudah itu adalah tulisan di peramban, yang dibacanya saat lahir.
 */
export function siarkanAba(aba: Aba) {
  if (aba.jenis === "buka-semua" || aba.jenis === "tutup-semua") {
    const nilai = aba.jenis === "tutup-semua" ? "1" : "0";
    for (const kunci of terdaftar.keys()) {
      try {
        window.localStorage.setItem(kunciCiut(kunci), nilai);
      } catch {
        // Peramban yang memblokir penyimpanan situs tetap dapat memakai
        // layarnya - hanya keadaannya tidak diingat sesudah dimuat ulang.
      }
    }
  }
  if (aba.jenis === "buka") {
    try {
      window.localStorage.setItem(kunciCiut(aba.kunci), "0");
    } catch {
      /* lihat catatan di atas */
    }
  }
  for (const f of pendengarAba) f(aba);
}
