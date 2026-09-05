/**
 * MENGENALI NAMA ORANG DI NASKAH PENGADILAN.
 *
 * ============================================================================
 * MASALAHNYA HURUF KAPITAL DI AWAL KALIMAT
 * ============================================================================
 *
 * Nama orang dikenali dari bentuknya: dua kata atau lebih berhuruf awal
 * kapital. Naskah pengadilan melanggar bentuk itu di dua tempat, dan keduanya
 * sering:
 *
 *   "Menghukum Andi Saputra menyerahkan sertifikat"
 *      Kata kerja amar berhuruf kapital karena mengawali kalimat, sehingga
 *      yang tertangkap adalah "Menghukum Andi Saputra" - bukan nama siapa pun.
 *
 *   "Pengadilan Agama Donggala"
 *      Nama lembaga berbentuk persis seperti nama orang.
 *
 * Kedua kekeliruan itu tidak menghasilkan galat. Yang pertama membuat
 * pemeriksaan kurang pihak menuduh hampir tiap petitum menyebut orang asing;
 * yang kedua membuat penyamaran mengganti nama pengadilan menjadi "Orang A",
 * sehingga naskah tersamar tidak dapat dibaca.
 *
 * ============================================================================
 * DIPOTONG DARI DEPAN, BUKAN DIBUANG SELURUHNYA
 * ============================================================================
 *
 * Membuang seluruh cocokan yang diawali kata umum akan MELEWATKAN nama
 * sungguhan yang mengikutinya - dan pada penyamaran, nama yang terlewat adalah
 * nama yang bocor. Maka awalannya dipotong, lalu sisanya dinilai ulang.
 *
 * "Menghukum Andi Saputra" -> potong "Menghukum" -> "Andi Saputra" - nama.
 * "Pengadilan Agama Donggala" -> potong dua kata -> "Donggala" - satu kata,
 * bukan nama menurut aturan bentuk ini, jadi dibiarkan.
 */

/**
 * Kata berhuruf kapital yang bukan bagian nama orang.
 *
 * Hanya kata yang lazim MENGAWALI atau MENYUSUN sebutan bukan-orang di naskah
 * pengadilan. Nama tempat sengaja tidak dimuat: daftarnya tak berujung, dan
 * aturan "sisa satu kata bukan nama" sudah menanganinya.
 */
export const KATA_BUKAN_NAMA = new Set([
  // sebutan peran dan lembaga
  "penggugat", "tergugat", "pemohon", "termohon", "majelis", "hakim", "ketua",
  "panitera", "jurusita", "mediator", "kuasa", "saksi", "ahli", "turut",
  "pengadilan", "agama", "negeri", "tinggi", "mahkamah", "republik", "indonesia",
  "kantor", "dinas", "kementerian", "badan", "lembaga", "direktorat",
  // sebutan naskah dan peraturan
  "undang", "peraturan", "pemerintah", "putusan", "penetapan", "berita", "acara",
  "sidang", "gugatan", "permohonan", "perkara", "surat", "akta", "salinan",
  "kompilasi", "hukum", "islam", "nomor", "tahun",
  // kata kerja amar dan kata pembuka alinea
  "menimbang", "mengingat", "mengadili", "menetapkan", "menyatakan", "menghukum",
  "mengabulkan", "menolak", "memerintahkan", "menjatuhkan", "memutuskan",
  "membebankan", "menyita", "demi", "keadilan", "berdasarkan", "ketuhanan",
  "yang", "maha", "esa", "bahwa", "atau", "apabila", "mohon",
  // agama, bulan, hari
  "kristen", "katolik", "hindu", "buddha", "konghucu",
  "januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus",
  "september", "oktober", "november", "desember",
  "senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "minggu",
]);

/** Penghubung nama yang ditulis huruf kecil dan tetap bagian dari nama. */
const PENGHUBUNG = new Set(["bin", "binti", "bt", "als", "alias"]);

/**
 * Pola nama: dua kata atau lebih berhuruf awal kapital, boleh berpenghubung.
 *
 * Dibuat sebagai fungsi, bukan tetapan bersama, karena RegExp global menyimpan
 * lastIndex - satu pola yang dipakai dua tempat akan melewatkan cocokan pada
 * pemanggilan berikutnya, dan kegagalannya bergantung urutan pemanggilan.
 */
export function polaNama(): RegExp {
  return /\b([A-Z][a-z]{1,}(?:\s+(?:bin|binti|bt|als)\.?\s+[A-Z][a-z]{1,}|\s+[A-Z][a-z]{1,})+)\b/g;
}

function bersihKata(kata: string): string {
  return kata.toLowerCase().replace(/[.,;]$/, "");
}

export type NamaTerpotong = {
  /** Kata umum di depan yang bukan bagian nama - dikembalikan apa adanya. */
  awalan: string;
  /** Sisa yang dinilai sebagai nama; kosong bila tidak ada nama tersisa. */
  nama: string;
};

/**
 * Memotong kata umum dari depan cocokan, lalu menilai sisanya.
 *
 * Sisa yang tinggal satu kata dianggap BUKAN nama - bukan karena nama satu
 * kata tidak ada (di Indonesia justru banyak), melainkan karena aturan bentuk
 * di sini tidak dapat membedakannya dari kata biasa berhuruf kapital. Nama
 * satu kata ditangani lewat nama ruas, bukan lewat pola.
 */
export function potongAwalanUmum(cocokan: string): NamaTerpotong {
  const kata = String(cocokan ?? "").trim().split(/\s+/).filter(Boolean);
  let mulai = 0;
  while (mulai < kata.length && KATA_BUKAN_NAMA.has(bersihKata(kata[mulai]))) mulai += 1;

  const sisa = kata.slice(mulai);
  // Penghubung yang tertinggal di depan bukan awal nama yang sah.
  while (sisa.length && PENGHUBUNG.has(bersihKata(sisa[0]))) sisa.shift();

  if (sisa.length < 2) return { awalan: cocokan, nama: "" };
  return { awalan: kata.slice(0, kata.length - sisa.length).join(" "), nama: sisa.join(" ") };
}

/**
 * Nama orang yang disebut sebuah kalimat.
 *
 * Sengaja sederhana. Ia akan melewatkan sebagian nama dan sesekali menangkap
 * yang bukan nama - dan itu diterima selama hasilnya dipakai sebagai
 * PERTANYAAN kepada petugas, bukan sebagai kesimpulan.
 */
export function namaDisebut(teks: string): string[] {
  const bersih = String(teks ?? "").replace(/\s+/g, " ");
  const pola = polaNama();
  const hasil = new Set<string>();
  let cocok: RegExpExecArray | null;
  while ((cocok = pola.exec(bersih)) !== null) {
    const { nama } = potongAwalanUmum(cocok[1]);
    if (nama) hasil.add(nama);
  }
  return [...hasil];
}
