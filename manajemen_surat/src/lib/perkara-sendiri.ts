/**
 * ============================================================================
 * "PERKARA SAYA" PADA DAFTAR ANTRIAN SIDANG
 * ============================================================================
 *
 * Daftar sidang satker memuat seluruh majelis. Yang dicari hakim ketika
 * membukanya adalah perkaranya sendiri, dan ia menemukannya dengan menyapu
 * mata dari atas ke bawah mencari namanya - tiap kali, tiap hari.
 *
 * ============================================================================
 * TIDAK ADA NOMOR PEGAWAI YANG MENGHUBUNGKANNYA
 * ============================================================================
 *
 * Yang dikirim SIPP untuk tiap baris adalah NAMA sebagai tulisan:
 * majelisNama, paniteraNama, jurusitaNama. Tidak ada NIP, tidak ada id
 * pengguna, dan akun portal tidak menyimpan padanan ke pegawai SIPP. Karena
 * itu penyaringan ini bersandar pada pencocokan NAMA - dan nama yang
 * dicocokkan mentah tidak akan pernah cocok:
 *
 *     akun portal : "Fulan Bin Alan"
 *     SIPP        : "Drs. H. Fulan Bin Alan, S.H., M.H."
 *
 * ============================================================================
 * GAGAL-TERBUKA, BUKAN GAGAL-TERTUTUP
 * ============================================================================
 *
 * Bila namanya tidak cocok dengan satu baris pun, yang benar BUKAN layar
 * kosong. Layar kosong pada daftar sidang terbaca sebagai "hari ini tidak ada
 * sidang" - kabar yang salah, dan salah pada arah yang paling berbahaya.
 *
 * Jalur ini karena itu memulangkan `adaYangCocok`, dan layarnya menampilkan
 * seluruh perkara beserta keterangannya ketika jawabannya tidak. Penjaga
 * sidang, pranata komputer, dan siapa pun yang tidak duduk di majelis mana
 * pun mendapatkan daftar penuh dengan sendirinya - tanpa perlu didaftar
 * sebagai pengecualian.
 */

/**
 * Peran yang melihat SELURUH perkara tanpa penyaringan.
 *
 * Ketiganya bekerja untuk seluruh satker, bukan untuk satu majelis: yang
 * mengurus data, yang mengurus akun, dan yang mengoperasikan layarnya.
 * Menyaring daftar mereka menurut nama berarti menyembunyikan justru yang
 * menjadi pekerjaan mereka.
 *
 * "Penjaga sidang" TERMASUK di sini, dan namanya "operator". Lihat catatan
 * peran itu di mock-data.ts: "penjaga sidang yang mengoperasikan SIPP dari
 * ruang sidang" - satu peran, dua sebutan. Ia tidak perlu baris tersendiri.
 *
 * ============================================================================
 * DIBACA DARI PERAN TAMBAHAN JUGA, DAN ITU BUKAN KELENGKAPAN
 * ============================================================================
 *
 * Operator SELALU peran tambahan. mock-data.ts menegaskannya: "dipasang lewat
 * peran tambahan pada akun, bukan menggantikan perannya" - sebab ia tugas yang
 * dilekatkan di samping jabatan, dan peran yang menggantikan akan mencabut
 * kewenangan jabatan seseorang hanya karena ia ditugasi menjaga sidang.
 * akses.ts:459 membacanya dengan cara itu pula.
 *
 * Penyaring yang hanya membaca peran UTAMA karena itu menyaring justru orang
 * yang diminta melihat semuanya: penjaga sidang yang jabatan aslinya staf
 * mendapat daftar tersaring atas namanya sendiri. Kegagalannya diam - ia hanya
 * tampak sebagai daftar yang lebih pendek.
 */
export const PERAN_LIHAT_SEMUA = new Set(["super-admin", "admin", "operator"]);

/** Benar bila salah satu peran akun - utama maupun tambahan - melihat semuanya. */
export function peranLihatSemua(
  peran: string,
  peranTambahan?: readonly string[] | null
): boolean {
  if (PERAN_LIHAT_SEMUA.has(String(peran || "").trim().toLowerCase())) return true;
  for (const satu of peranTambahan ?? []) {
    if (PERAN_LIHAT_SEMUA.has(String(satu || "").trim().toLowerCase())) return true;
  }
  return false;
}

/** Gelar dan pecahannya - "S.H." menjadi "s h" begitu titiknya dipecah. */
const GELAR = new Set([
  "drs",
  "dra",
  "dr",
  "h",
  "hj",
  "sh",
  "shi",
  "si",
  "mh",
  "ma",
  "mag",
  "ag",
  "se",
  "st",
  "ir",
  "lc",
  "msi",
  "mkn",
  "spdi",
  "sag",
  "sh i",
  "bin",
  "binti",
]);

/**
 * Potongan nama yang layak dibandingkan.
 *
 * Potongan satu-dua huruf dibuang seluruhnya: titik gelar dipecah menjadi
 * spasi, sehingga "S.H., M.H." meninggalkan "s", "h", "m", "h" - dan daftar
 * gelar tidak akan pernah lengkap menghadapi pecahan seperti itu. Satu huruf
 * yang terlewat sudah cukup membuat dua tulisan nama orang yang sama tidak
 * pernah cocok.
 */
export function potonganNamaPetugas(nama: string): string[] {
  return String(nama || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((k) => k.length > 2 && !GELAR.has(k));
}

/**
 * ============================================================================
 * MEMECAH SATU RUAS MENJADI NAMA-NAMA ORANG
 * ============================================================================
 *
 * Satu ruas memuat seluruh majelis, disatukan bot dengan ", " (lihat
 * satukanPetugas di aleta_bot). Masalahnya gelar JUGA memakai koma:
 *
 *     "Mazidah, S.Ag., M.H., Sudarmin H.I.M. Tang, S.H.I.,M.H"
 *
 * Memecahnya pada koma menghasilkan lima potongan untuk dua orang. Yang
 * membedakan: potongan yang seluruh katanya gelar - "S.Ag.", "M.H." - milik
 * nama SEBELUMNYA, bukan nama baru. Potongan yang menyisakan sepatah kata
 * bukan-gelar barulah orang berikutnya.
 */
export function pecahNamaPetugas(teks: string): string[] {
  const hasil: string[] = [];
  for (const potong of String(teks || "").split(",")) {
    const isi = potong.trim();
    if (!isi) continue;
    if (potonganNamaPetugas(isi).length === 0 && hasil.length > 0) {
      // Seluruhnya gelar - menempel pada nama sebelumnya.
      hasil[hasil.length - 1] += `, ${isi}`;
      continue;
    }
    hasil.push(isi);
  }
  return hasil;
}

/**
 * ============================================================================
 * SATU NAMA AKUN LAWAN SATU NAMA PETUGAS
 * ============================================================================
 *
 * Dua aturan, dan yang pertama ada karena satu kekeliruan yang TERUKUR pada
 * data satker - bukan karena kehati-hatian yang dikarang.
 *
 * Di antara 63 hakim dan panitera Donggala ada dua orang berbeda:
 *
 *     "M. Tang"               NIP 195812311987031030
 *     "Sudarmin H.I.M. Tang"  NIP 197910092007041001
 *
 * Aturan "seluruh potongan nama akun harus ada" membuat perkara Sudarmin ikut
 * terbawa ke daftar M. Tang: potongan namanya tinggal "tang" belaka setelah
 * "M." dibuang, dan "tang" memang ada di dalam nama Sudarmin. Hakim yang
 * menyaring daftarnya akan mendapat baris yang terasa masuk akal, dan tidak
 * pernah tahu sebagiannya perkara orang lain.
 *
 * Karena itu:
 *
 *   satu potongan   himpunannya harus SAMA PERSIS. ["tang"] lawan
 *                   ["sudarmin", "tang"] tidak sama, dan M. Tang tetap
 *                   mencocoki namanya sendiri - "Drs. M. Tang, M.H." juga
 *                   menyisakan ["tang"] belaka.
 *   dua atau lebih  cukup termuat. Nama akun kerap lebih pendek daripada
 *                   tulisan SIPP-nya, dan dua potongan yang sama-sama cocok
 *                   sudah cukup jarang untuk tidak menabrak orang lain.
 *
 * Terukur sesudahnya atas 63 hakim dan panitera Donggala: 63/63 mencocoki
 * tulisan namanya sendiri, dan tabrakan antar-ORANG tersisa nol. Delapan
 * pasangan yang masih saling mencocoki seluruhnya baris KEMBAR untuk orang
 * yang sama - Mazidah tercatat dua kali dan Munifa tiga kali, NIP-nya hanya
 * berbeda pada digit terakhir. Kembaran itu persoalan data SIPP, bukan
 * persoalan aturan ini, dan menyaringnya di sini akan menyembunyikan
 * kembarannya alih-alih memperbaikinya.
 */
export function namaCocokSatu(namaAkun: string, namaPetugas: string): boolean {
  const akun = potonganNamaPetugas(namaAkun);
  if (akun.length === 0) return false;
  const petugas = potonganNamaPetugas(namaPetugas);
  if (petugas.length === 0) return false;

  const punya = new Set(petugas);
  if (!akun.every((k) => punya.has(k))) return false;
  if (akun.length >= 2) return true;
  // Satu potongan - tuntut himpunannya sama, lihat sebabnya di atas.
  return new Set(akun).size === punya.size;
}

/**
 * Benar bila `namaAkun` adalah salah satu orang yang tertulis di `teksBaris`.
 *
 * Ruasnya dipecah lebih dahulu. Mencocokkan langsung ke seluruh ruas berarti
 * nama seorang hakim dapat tersusun dari potongan milik TIGA orang berbeda
 * yang kebetulan duduk semajelis.
 */
export function namaAdaDi(namaAkun: string, teksBaris: string): boolean {
  return pecahNamaPetugas(teksBaris).some((satu) => namaCocokSatu(namaAkun, satu));
}

export type BarisPetugas = {
  majelisNama?: string;
  paniteraNama?: string;
  jurusitaNama?: string;
};

/**
 * Ruas mana yang lebih dahulu diperiksa menurut peran akunnya.
 *
 * Perannya dipakai untuk URUTAN, bukan untuk membatasi. Peran portal dan tugas
 * SIPP kerap tidak sejalan - panitera muda yang masih menjadi panitera
 * pengganti, hakim yang juga ketua majelis lain - dan membatasi pemeriksaan
 * pada satu ruas saja akan menyembunyikan perkara yang sungguh miliknya.
 *
 * Gunanya urutan: sebutan yang dipulangkan menyebut kedudukan yang paling
 * mungkin benar, dan sebutan itulah yang dibaca orang pada tombolnya.
 */
function urutanRuas(peran: string): Array<keyof BarisPetugas> {
  const p = String(peran || "").toLowerCase();
  if (p === "hakim" || p === "ketua" || p === "wakil-ketua") {
    return ["majelisNama", "paniteraNama", "jurusitaNama"];
  }
  if (p.startsWith("panitera")) return ["paniteraNama", "majelisNama", "jurusitaNama"];
  if (p === "jurusita") return ["jurusitaNama", "paniteraNama", "majelisNama"];
  return ["majelisNama", "paniteraNama", "jurusitaNama"];
}

const SEBUTAN: Record<keyof BarisPetugas, string> = {
  majelisNama: "majelis",
  paniteraNama: "panitera pengganti",
  jurusitaNama: "jurusita",
};

/**
 * Memeriksa satu baris - dan menyebutkan SEBAGAI APA ia cocok.
 *
 * Sebutannya ikut supaya layar dapat mengatakan "sebagai panitera pengganti"
 * alih-alih hanya "perkara saya". Penyaringan yang tidak dapat menjelaskan
 * dirinya sendiri adalah penyaringan yang orang tidak berani percayai ketika
 * jumlah barisnya terasa kurang.
 */
export function perkaraSendiri(
  baris: BarisPetugas,
  akun: { nama: string; peran: string }
): { cocok: boolean; sebagai: string } {
  for (const ruas of urutanRuas(akun.peran)) {
    if (namaAdaDi(akun.nama, String(baris[ruas] || ""))) {
      return { cocok: true, sebagai: SEBUTAN[ruas] };
    }
  }
  return { cocok: false, sebagai: "" };
}

/**
 * Menyaring seluruh daftar sekaligus, dan mengatakan apa yang terjadi.
 *
 * `berlaku` menjawab pertanyaan yang berbeda dari `adaYangCocok`:
 *
 *   berlaku salah      akunnya memang melihat semuanya - peran lintas satker,
 *                      atau penyaringnya dimatikan orangnya sendiri
 *   berlaku benar,
 *   adaYangCocok salah namanya tidak duduk di satu baris pun hari ini; daftar
 *                      penuh dipulangkan, dan layar WAJIB mengatakan sebabnya
 *
 * Keduanya memulangkan daftar yang sama panjang. Yang membedakan hanya apa
 * yang harus dikatakan kepada yang membacanya - dan tidak mengatakannya
 * membuat daftar penuh terbaca sebagai daftar yang sudah disaring.
 */
export function saringPerkaraSendiri<T extends BarisPetugas>(
  daftar: T[],
  akun: { nama: string; peran: string; peranTambahan?: readonly string[] | null } | null,
  hanyaMilikSaya: boolean
): { baris: T[]; berlaku: boolean; adaYangCocok: boolean; sebagai: string } {
  const nama = String(akun?.nama || "").trim();
  const peran = String(akun?.peran || "").trim();

  // Peran TAMBAHAN ikut dibaca - operator/penjaga sidang tidak pernah menjadi
  // peran utama. Lihat catatan di kepala berkas.
  if (!hanyaMilikSaya || !nama || peranLihatSemua(peran, akun?.peranTambahan)) {
    return { baris: daftar, berlaku: false, adaYangCocok: false, sebagai: "" };
  }

  const cocok: T[] = [];
  const sebutan = new Set<string>();
  for (const baris of daftar) {
    const hasil = perkaraSendiri(baris, { nama, peran });
    if (hasil.cocok) {
      cocok.push(baris);
      sebutan.add(hasil.sebagai);
    }
  }

  if (cocok.length === 0) {
    // Gagal-TERBUKA. Lihat catatan di kepala berkas: layar kosong pada daftar
    // sidang terbaca sebagai "hari ini tidak ada sidang".
    return { baris: daftar, berlaku: true, adaYangCocok: false, sebagai: "" };
  }

  return {
    baris: cocok,
    berlaku: true,
    adaYangCocok: true,
    sebagai: [...sebutan].join(" dan "),
  };
}
