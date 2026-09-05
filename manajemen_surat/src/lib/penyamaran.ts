/**
 * PENYAMARAN (J6) - anonimisasi berkas ABT untuk pengujian.
 *
 * ============================================================================
 * SATU ORANG SATU SEBUTAN, DAN SEBUTANNYA TETAP DI SELURUH BERKAS
 * ============================================================================
 *
 * Penyamaran yang mengganti tiap nama dengan "XXX" menghasilkan naskah yang
 * tidak dapat dipakai menguji apa pun: keterangan saksi yang menyebut tiga
 * orang berbeda menjadi tiga "XXX", dan yang membacanya kehilangan siapa
 * mengatakan apa tentang siapa.
 *
 * Maka tiap orang mendapat sebutan tetap - "Orang A", "Orang B" - dan sebutan
 * itu sama di seluruh berkas. Naskahnya tetap dapat dibaca dan diuji, tanpa
 * satu pun nama sebenarnya.
 *
 * ============================================================================
 * TIDAK DAPAT DIBALIK, DAN SENGAJA BEGITU
 * ============================================================================
 *
 * Pemetaan nama ke sebutan hanya hidup selama pemanggilan berlangsung; ia
 * tidak disimpan dan tidak dikembalikan bersama hasilnya. Penyamaran yang
 * menyimpan kunci pembalik bukan penyamaran melainkan penyandian, dan berkas
 * yang tersandi tetap berisi data pribadi.
 *
 * Garam yang berbeda tiap berkas juga menghalangi penggabungan: "Orang A" di
 * satu berkas tidak dapat dicocokkan dengan "Orang A" di berkas lain, sehingga
 * dua berkas tersamar tidak dapat disatukan menjadi satu jati diri.
 *
 * ============================================================================
 * YANG TIDAK DIKENALI TETAP DITANDAI
 * ============================================================================
 *
 * Pengenal nama di sini bekerja atas bentuk tulisan, dan bentuk tulisan tidak
 * pernah menangkap semuanya. Karena itu hasilnya membawa `dicurigai` - potongan
 * yang menyerupai jati diri tetapi tidak tersamarkan. Berkas yang dicurigainya
 * tidak kosong tidak boleh keluar tanpa dibaca manusia lebih dulu.
 */

import { createHash } from "node:crypto";

import { polaNama, potongAwalanUmum } from "@/lib/nama-orang";

export type HasilSamar = {
  teks: string;
  /** Berapa jati diri yang benar-benar diganti. */
  jumlahDiganti: number;
  /** Potongan yang menyerupai jati diri tetapi tidak tersamarkan. */
  dicurigai: string[];
};

export type Penyamar = {
  samarkanTeks(teks: string): HasilSamar;
  samarkanNilai(nilai: unknown, ruas: string): unknown;
};

const HURUF = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function sebutanKe(urutan: number): string {
  if (urutan < HURUF.length) return HURUF[urutan];
  const pertama = Math.floor(urutan / HURUF.length) - 1;
  return `${HURUF[pertama]}${HURUF[urutan % HURUF.length]}`;
}


const POLA_NIK = /\b\d{16}\b/g;
const POLA_TELEPON = /\b(?:\+62|62|0)8\d{7,12}\b/g;
const POLA_EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
const POLA_NOMOR_PERKARA = /\b\d{1,5}\/[A-Za-z.]+(?:\/[A-Za-z.]+)?\/\d{4}\/[A-Za-z.]+\b/g;
const POLA_TANGGAL =
  /\b\d{1,2}\s+(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4}\b/g;

/** Yang masih menyerupai jati diri sesudah penyamaran berjalan. */
const POLA_CURIGA: Array<{ nama: string; pola: RegExp }> = [
  { nama: "angka 16 digit", pola: /\b\d{16}\b/g },
  { nama: "nomor telepon", pola: /\b(?:\+62|62|0)8\d{7,12}\b/g },
  { nama: "surel", pola: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  { nama: "nomor perkara", pola: /\b\d{1,5}\/[A-Za-z.]+(?:\/[A-Za-z.]+)?\/\d{4}\/[A-Za-z.]+\b/g },
];

/**
 * Membuat penyamar untuk SATU berkas.
 *
 * Garamnya wajib. Tanpa garam, sidik nama yang sama menghasilkan sebutan yang
 * sama di seluruh berkas, dan dua berkas tersamar dapat disatukan kembali
 * menjadi satu jati diri hanya dengan mencocokkan sebutannya.
 */
export function buatPenyamar(garam: string): Penyamar {
  const asin = String(garam ?? "").trim();
  if (!asin) throw new Error("Penyamaran menuntut garam; tanpa garam ia dapat dibalik.");

  const petaOrang = new Map<string, string>();
  const petaNomor = new Map<string, string>();
  let berikutnya = 0;

  function sebutanOrang(nama: string): string {
    const kunci = nama.toLowerCase().replace(/\s+/g, " ").trim();
    const sudah = petaOrang.get(kunci);
    if (sudah) return sudah;
    const sebutan = `Orang ${sebutanKe(berikutnya)}`;
    berikutnya += 1;
    petaOrang.set(kunci, sebutan);
    return sebutan;
  }

  function sebutanNomor(nomor: string): string {
    const sudah = petaNomor.get(nomor);
    if (sudah) return sudah;
    const sidik = createHash("sha256").update(`${asin}:${nomor}`).digest("hex").slice(0, 6).toUpperCase();
    const sebutan = `PERKARA-${sidik}`;
    petaNomor.set(nomor, sebutan);
    return sebutan;
  }

  function samarkanTeks(teks: string): HasilSamar {
    let isi = String(teks ?? "");
    let jumlah = 0;

    // Nomor perkara lebih dulu: bentuknya memuat huruf kapital yang dapat
    // tertangkap pola nama bila namanya diganti duluan.
    isi = isi.replace(POLA_NOMOR_PERKARA, (cocok) => {
      jumlah += 1;
      return sebutanNomor(cocok);
    });
    isi = isi.replace(POLA_NIK, () => {
      jumlah += 1;
      return "[NIK]";
    });
    isi = isi.replace(POLA_TELEPON, () => {
      jumlah += 1;
      return "[TELEPON]";
    });
    isi = isi.replace(POLA_EMAIL, () => {
      jumlah += 1;
      return "[SUREL]";
    });
    // Awalan umum DIPOTONG, bukan membuat seluruh cocokan dilewati: nama yang
    // terlewat pada penyamaran adalah nama yang bocor.
    isi = isi.replace(polaNama(), (cocok) => {
      const { awalan, nama } = potongAwalanUmum(cocok);
      if (!nama) return cocok;
      jumlah += 1;
      return awalan ? `${awalan} ${sebutanOrang(nama)}` : sebutanOrang(nama);
    });
    isi = isi.replace(POLA_TANGGAL, () => {
      jumlah += 1;
      return "[TANGGAL]";
    });

    const dicurigai: string[] = [];
    for (const { nama, pola } of POLA_CURIGA) {
      const sisa = isi.match(new RegExp(pola.source, pola.flags));
      if (sisa?.length) dicurigai.push(`${nama}: ${[...new Set(sisa)].slice(0, 3).join(", ")}`);
    }

    return { teks: isi, jumlahDiganti: jumlah, dicurigai };
  }

  /**
   * Menyamarkan satu nilai menurut nama ruasnya.
   *
   * Ruas yang jelas berisi nama diganti seluruhnya menjadi sebutan, bukan
   * disaring dengan pola. Isi ruas "namaSaksi" adalah nama meskipun bentuknya
   * satu kata, dan pola dua-kata akan melewatkannya.
   */
  function samarkanNilai(nilai: unknown, ruas: string): unknown {
    const teks = String(nilai ?? "");
    if (!teks.trim()) return nilai;
    const nama = String(ruas ?? "").toLowerCase();

    if (nama.startsWith("nama")) return sebutanOrang(teks);
    if (nama.includes("nomorperkara")) return sebutanNomor(teks);
    if (nama.startsWith("tanggal")) return "[TANGGAL]";
    if (nama.startsWith("perkaraid")) return sebutanNomor(teks);
    return samarkanTeks(teks).teks;
  }

  return { samarkanTeks, samarkanNilai };
}
