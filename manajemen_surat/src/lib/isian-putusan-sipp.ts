
import { sebutanSatuPihak, type BahanSebutan } from "@/lib/sebutan-pihak";
import { pecahNaskahPutusan } from "@/lib/susunan-putusan";

/**
 * ============================================================================
 * ISIAN BORANG PUTUSAN SIPP - DISUSUN DI SINI, DIISIKAN EKSTENSI
 * ============================================================================
 *
 * Borang Putusan Akhir SIPP menuntut potongan yang terpisah-pisah:
 * Pertimbangan Hukum, Amar, Amar Anonim, status putusan, verstek, dan sumber
 * hukum. Draf ALETA menyimpannya sebagai satu naskah utuh.
 *
 * Berkas ini yang menjembatani keduanya, dan ia sengaja berada di portal -
 * bukan di dalam ekstensi. Ekstensi berjalan di halaman SIPP, di peramban
 * petugas, tanpa satu pun uji yang dapat menjalankannya; yang di sini diuji
 * tiap kali pemeriksaan berkala berjalan. Ekstensi hanya mengisi apa yang
 * sudah diputuskan di sini.
 *
 * ============================================================================
 * YANG TIDAK DIKERJAKAN DI SINI, DAN SEBABNYA
 * ============================================================================
 *
 * Tidak ada nomor status putusan yang ditulis tetap. Daftar pilihan pada
 * borang SIPP sudah disaring SIPP sendiri menurut jenis perkara dan alur
 * perkaranya - 132 baris status_putusan, hanya sebagian yang sah untuk satu
 * perkara. Ekstensi mencocokkan pada pilihan yang benar-benar ada di halaman,
 * dan berkas ini hanya menyebut NAMANYA. Menghafal nomornya di sini berarti
 * menebak apa yang sudah diketahui halamannya.
 *
 * Berkas ini sendiri tidak menekan apa pun - ia hanya menyusun usulan isian.
 * Tetapi yang MEMAKAINYA menekan: Putusan otomatis di ekstensi (konten.js,
 * bagianIsiPutusan) menekan tombol Simpan SIPP sendiri sesudah semua isian
 * yang dicentang terisi dan praperiksa tidak menahan, dan antrean putusan
 * massal menekannya untuk tiap perkara yang tidak ditahan praperiksa. Catatan
 * yang dipulangkan di bawah mengatakan itu apa adanya - catatan lama yang
 * berbunyi "Simpan tidak ditekan ALETA" keliru sejak Simpan otomatis dibuka.
 */

export type PihakPerkara = {
  nama: string;
  /** 1 = penggugat/pemohon, 2 = tergugat/termohon. */
  pihakKe: number | null;
  /** "pihak" atau "kuasa". */
  jenis?: string;
};

export type IsianPutusanSipp = {
  /** Pertimbangan hukum, untuk CKEditor "perhum". */
  pertimbangan: string;
  /** Amar putusan, untuk CKEditor "amar". */
  amar: string;
  /** Amar yang sudah disamarkan namanya, untuk CKEditor "amar_anonim". */
  amarAnonim: string;
  /** Nama pihak yang disamarkan, supaya petugas dapat memeriksanya. */
  namaDisamarkan: Array<{ nama: string; menjadi: string }>;
  /** Keterangan yang harus dibaca petugas sebelum mengisi. */
  catatan: string[];
  /** Bagian wajib yang belum ada isinya pada draf. */
  belumTerisi: string[];
};

function bersih(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

/**
 * Jenis perkara yang beracara sebagai PERMOHONAN.
 *
 * "Cerai talak" ada di dalamnya dan itu bukan kelalaian penulisan: di
 * Pengadilan Agama, suami mengajukan PERMOHONAN izin mengucapkan ikrar talak,
 * sehingga para pihaknya Pemohon dan Termohon - bukan Penggugat dan Tergugat.
 * Cerai gugat sebaliknya, dan karena itu "cerai" saja tidak pernah dijadikan
 * penanda di sini.
 *
 * Menyebutnya keliru pada amar anonim bukan sekadar salah kata: ia mengubah
 * jenis perkaranya di mata siapa pun yang membaca putusan itu kelak di
 * Direktori Putusan.
 */
// Pola lama ditulis di sini dan salah pada 3.999 dari 10.120 perkara satker,
// sebagian besar hanya karena SIPP menulis "Istbat" sedangkan polanya
// "itsbat". Aturannya kini satu tempat - lihat src/lib/sebutan-pihak.ts,
// yang memakai alur_perkara_id dan jenis_perkara_id lebih dulu dan menyimpan
// pencocokan kata sebagai cadangan terakhir.

/**
 * Sebutan acara untuk satu pihak.
 *
 * Perkara permohonan memakai Pemohon/Termohon, gugatan memakai
 * Penggugat/Tergugat. Salah menyebutnya pada amar anonim bukan sekadar salah
 * kata: ia mengubah jenis perkaranya di mata yang membaca.
 */
export function sebutanPihak(
  pihakKe: number | null | undefined,
  jenisPerkara: string,
  jenis?: string,
  bahanTambahan?: BahanSebutan
): string {
  return sebutanSatuPihak(pihakKe, { ...(bahanTambahan ?? {}), jenisPerkaraNama: jenisPerkara }, jenis);
}

/** Memasang tanda pelarian untuk dipakai di dalam ekspresi reguler. */
function lolos(teks: string): string {
  return teks.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * ============================================================================
 * BENTUK SAMARAN - DIUKUR DARI AMAR ANONIM SATKER, BUKAN DIKARANG
 * ============================================================================
 *
 * Diukur atas 462 amar anonim 2025-2026 yang disimpan petugas PA Donggala di
 * perkara_putusan_anonim:
 *
 *   isi kurung sesudah sebutan   "( xxx )" - x kecil - 324 dari 621 kurung;
 *                                sebutannya sendiri "( Tergugat )" 134;
 *                                "( XXX )" 28; sisanya 135 nama atau
 *                                keterangan yang memang tidak disamarkan.
 *                                (Dihitung ulang 26 Sep 2026 dengan pola
 *                                POLA_KURUNG_SESUDAH_SEBUTAN di bawah.)
 *   nama di luar kurung          "xxx" tanpa kurung ("bernama xxx" 19 kali);
 *                                "( xxx )" di luar kurung tidak pernah.
 *
 * Panjang deret x pada kurung berbeda-beda (3 x paling sering: 112 kali), dan
 * tidak ada aturan yang dapat dibaca darinya - jadi yang dipakai tiga.
 */
export const SAMARAN_KURUNG = "( xxx )";
export const SAMARAN_NAMA = "xxx";

/** Sebutan pihak diikuti kurung: "Tergugat ( Moh. Alwi bin Wahidin )". */
const POLA_KURUNG_SESUDAH_SEBUTAN =
  /\b((?:para\s+)?(?:Penggugat|Tergugat|Pemohon|Termohon)(?:\s+(?:Konvensi|Rekonvensi|I{1,3}|IV))?)\s*\(\s*([^()]{1,160}?)\s*\)/gi;

/** Isi kurung yang memang NAMA - bukan sebutan, nomor, atau keterangan. */
function isiKurungBerupaNama(isi: string): boolean {
  const teks = bersih(isi);
  if (!teks) return false;
  if (/^x+$/i.test(teks.replace(/\s+/g, ""))) return false;
  if (/\d/.test(teks)) return false;
  if (/^(?:para\s+)?(?:pihak|penggugat|tergugat|pemohon|termohon|kuasa|turut)\b/i.test(teks)) return false;
  if (/\b(?:selanjutnya|disebut|dahulu|semula|sekarang)\b/i.test(teks)) return false;
  return /[A-Z]/.test(teks);
}

/** Satu kata nama: berawal huruf besar, boleh bertitik atau berapostrof. */
const KATA_NAMA = String.raw`[A-Z][A-Za-z'’\`.\-]*`;
const POLA_BIN_BINTI = new RegExp(
  String.raw`((?:${KATA_NAMA}\s+){0,2}${KATA_NAMA})\s+(bin|binti|Bin|Binti|BIN|BINTI)\s+(${KATA_NAMA}(?:\s+${KATA_NAMA}){0,2}(?:\s+alias\s+${KATA_NAMA}(?:\s+${KATA_NAMA}){0,2})?)`,
  "g"
);

/**
 * Kata berhuruf besar yang BUKAN bagian nama: kata kerja amar, sebutan, dan
 * keterangan tempat. Dibuang dari tepi nama sebelum disamarkan.
 */
const BUKAN_NAMA = new Set([
  "menetapkan", "menyatakan", "menghukum", "memberi", "memberikan", "mengabulkan", "membebankan",
  "memerintahkan", "menjatuhkan", "mengizinkan", "menolak", "mengadili", "penggugat", "tergugat",
  "pemohon", "termohon", "para", "anak", "almarhum", "almarhumah", "alm", "alm.", "ahli", "waris",
  "saudara", "sdr", "sdr.", "bapak", "ibu", "nama", "bernama", "kepada", "dari", "dengan", "dan",
  "terhadap", "antara", "hak", "asuh", "laki-laki", "perempuan", "umur", "lahir", "tanggal", "desa",
  "kelurahan", "kecamatan", "kabupaten", "kota", "provinsi", "sulawesi", "tengah", "donggala",
  "pengadilan", "agama", "kantor", "urusan", "kua", "nomor", "pasal", "rp", "konvensi", "rekonvensi",
  "i", "ii", "iii", "iv", "dalam", "pokok", "perkara", "eksepsi",
]);
const SEBUTAN_ACARA = /^(?:penggugat|tergugat|pemohon|termohon)$/i;
/** Angka Romawi yang dipakai sebagai akhiran sebutan ("Pemohon II"), huruf besar persis. */
const ROMAWI = /^(?:I|II|III|IV)$/;

/**
 * Menyamarkan "Nama bin/binti Nama" yang tersisa sesudah nama pihak diganti.
 *
 * Nama di depan bin/binti yang sudah berupa sebutan ("Pemohon bin BAHRI" -
 * pihak yang namanya di SIPP ditulis tanpa bin) cukup dibuang bin-nya: orang
 * itu sudah tersamar oleh sebutannya. Selebihnya - nama anak, almarhum, ahli
 * waris - diganti SAMARAN_NAMA.
 */
function samarkanBinBinti(teks: string, diganti: Array<{ nama: string; menjadi: string }>): string {
  return teks.replace(POLA_BIN_BINTI, (cocok: string, depan: string, bin: string, belakang: string) => {
    const kataDepan = depan.split(/\s+/);
    // Kata bukan-nama di tepi kiri tetap tertulis.
    let awalNama = 0;
    while (awalNama < kataDepan.length && BUKAN_NAMA.has(kataDepan[awalNama].toLowerCase())) awalNama += 1;
    const tetapDepan = kataDepan.slice(0, awalNama);
    const namaDepan = kataDepan.slice(awalNama);
    // Nama sesudah bin berhenti pada kata bukan-nama pertama.
    //
    // Angka Romawi dikecualikan di sini: sesudah bin/binti ia bukan akhiran
    // sebutan ("Pemohon I") melainkan awal nama Bali - "binti I Ketut ...".
    // Tanpa pengecualian ini, "Komang ... binti I Ketut ... alias I KT ..."
    // lolos utuh ke amar anonim (terukur pada satu amar 2026).
    const kataBelakang = belakang.split(/\s+/);
    let akhirNama = 0;
    while (
      akhirNama < kataBelakang.length &&
      (ROMAWI.test(kataBelakang[akhirNama]) || !BUKAN_NAMA.has(kataBelakang[akhirNama].toLowerCase()))
    ) {
      akhirNama += 1;
    }
    // "Zea binti Pemohon": ayahnya pihak yang sudah tersamar, tetapi nama
    // anaknya tidak - seluruh sebutan anak itu yang disamarkan, beserta
    // akhiran Romawinya ("binti Pemohon II").
    if (akhirNama === 0 && SEBUTAN_ACARA.test(kataBelakang[0]) && namaDepan.length > 0) {
      akhirNama = kataBelakang.length > 1 && ROMAWI.test(kataBelakang[1]) ? 2 : 1;
    }
    if (akhirNama === 0) return cocok;
    const sisaBelakang = kataBelakang.slice(akhirNama).join(" ");
    const namaBelakang = kataBelakang.slice(0, akhirNama).join(" ");
    const ekor = sisaBelakang ? ` ${sisaBelakang}` : "";

    const sebutanDiDepan = tetapDepan.length > 0 && SEBUTAN_ACARA.test(tetapDepan[tetapDepan.length - 1]);
    if (namaDepan.length === 0 && sebutanDiDepan) {
      diganti.push({ nama: `${bin} ${namaBelakang}`, menjadi: "(dibuang)" });
      return `${tetapDepan.join(" ")}${ekor}`;
    }
    if (namaDepan.length === 0) return cocok;
    const nama = `${namaDepan.join(" ")} ${bin} ${namaBelakang}`;
    diganti.push({ nama, menjadi: SAMARAN_NAMA });
    return `${tetapDepan.length ? `${tetapDepan.join(" ")} ` : ""}${SAMARAN_NAMA}${ekor}`;
  });
}

/**
 * Mengganti nama para pihak dengan sebutan acaranya, lalu menyamarkan nama
 * yang tersisa dalam bentuk yang dipakai satker.
 *
 * ============================================================================
 * TIGA LANGKAH, URUTANNYA MENENTUKAN
 * ============================================================================
 *
 *   1. Isi kurung sesudah sebutan menjadi "( xxx )" - dikerjakan PERTAMA,
 *      atas nama aslinya. Dikerjakan sesudah nama pihak diganti, isinya
 *      menjadi "Tergugat ( Tergugat )" atau - bila nama di SIPP ditulis tanpa
 *      bin - "Pemohon ( Pemohon bin BAHRI )": 6 dari 105 amar anonim 2026
 *      membocorkan nama ayah persis begitu.
 *   2. Nama pihak yang diketahui dari SIPP diganti sebutan acaranya.
 *   3. "Nama bin/binti Nama" yang masih tersisa disamarkan.
 *
 * ============================================================================
 * YANG PANJANG LEBIH DULU
 * ============================================================================
 *
 * "SITI AMINAH" dan "SITI" dapat sama-sama muncul sebagai nama pihak. Bila
 * yang pendek diganti lebih dulu, sisa "AMINAH" tertinggal di naskah dan
 * anonimisasinya bocor pada nama yang justru paling mudah dikenali. Karena itu
 * nama diurutkan dari yang terpanjang.
 *
 * ============================================================================
 * INI BUKAN JAMINAN
 * ============================================================================
 *
 * Nama tanpa bin/binti di luar kurung - nama anak sesudah "bernama", nama
 * saksi - alamat, dan nomor identitas tidak ikut tersamar. Karena itu hasilnya
 * selalu disertai catatan, dan petugas tetap membacanya. Menyebutnya "sudah
 * anonim" tanpa dibaca manusia adalah cara paling rapi untuk menerbitkan nama
 * orang.
 */
export function anonimkanAmar(
  amar: string,
  pihak: PihakPerkara[],
  jenisPerkara = ""
): { teks: string; diganti: Array<{ nama: string; menjadi: string }> } {
  const teks = bersih(amar);
  if (!teks) return { teks: "", diganti: [] };

  const daftar = (Array.isArray(pihak) ? pihak : [])
    .map((satu) => ({ nama: bersih(satu?.nama), pihakKe: satu?.pihakKe ?? null, jenis: bersih(satu?.jenis) }))
    .filter((satu) => satu.nama.length >= 3)
    .sort((a, b) => b.nama.length - a.nama.length);

  const diganti: Array<{ nama: string; menjadi: string }> = [];

  // 1. Isi kurung sesudah sebutan.
  let hasil = teks.replace(POLA_KURUNG_SESUDAH_SEBUTAN, (cocok: string, sebutan: string, isi: string) => {
    if (!isiKurungBerupaNama(isi)) return cocok;
    diganti.push({ nama: bersih(isi), menjadi: SAMARAN_KURUNG });
    return `${sebutan} ${SAMARAN_KURUNG}`;
  });

  // 2. Nama pihak yang diketahui dari SIPP.
  for (const satu of daftar) {
    const menjadi = sebutanPihak(satu.pihakKe, jenisPerkara, satu.jenis);
    // Batas kata di kedua ujung: tanpa itu, nama yang kebetulan menjadi
    // bagian kata lain ikut terganti.
    const pola = new RegExp(`(^|[^A-Za-z])(${lolos(satu.nama)})(?=[^A-Za-z]|$)`, "gi");
    if (!pola.test(hasil)) continue;
    pola.lastIndex = 0;
    hasil = hasil.replace(pola, (_cocok, depan) => `${depan}${menjadi}`);
    diganti.push({ nama: satu.nama, menjadi });
  }

  // 3. "Nama bin/binti Nama" yang tersisa.
  hasil = samarkanBinBinti(hasil, diganti);

  return { teks: hasil, diganti };
}

/**
 * Menyusun usulan isian borang putusan SIPP dari draf ALETA.
 *
 * Bagian yang kosong pada draf dikembalikan kosong dan disebut pada
 * belumTerisi - bukan diisi kalimat penambal. Borang putusan yang terisi
 * kalimat penambal akan tersimpan dan tercetak persis seperti itu.
 */
/**
 * ============================================================================
 * TIAP BUTIR AMAR BERDIRI SEBAGAI PARAGRAFNYA SENDIRI
 * ============================================================================
 *
 * Amar putusan dibaca sebagai daftar, bukan sebagai alinea. Empat butir yang
 * mengalir menjadi satu blok - "1. Menyatakan ... tidak hadir; 2. Mengabulkan
 * ... 3. Menjatuhkan ..." - memaksa pembacanya mencari nomornya di tengah
 * kalimat, dan itulah bentuk yang tampil di CKEditor selama ini.
 *
 * Dikeluarkan sebagai <p> per butir, bukan sebagai baris baru. Yang diterima
 * CKEditor diurai sebagai HTML: baris baru di dalamnya runtuh menjadi satu
 * spasi, dan tidak satu pun jarak yang terlihat. Kolom amar_putusan di SIPP
 * memang menyimpan HTML - putusan yang sudah ada di sana pun begitu.
 *
 * Penomorannya TIDAK diubah, ditambah, maupun diurutkan ulang. Yang dikerjakan
 * hanya memberi tiap butir paragrafnya sendiri.
 */
export function paragrafButir(teks: string): string {
  const bersihTeks = bersih(teks);
  if (!bersihTeks) return "";

  let butir = bersihTeks
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((satu) => satu.trim())
    // ========================================================================
    // BARIS HAMPA DIBUANG - IA MENJADI BARIS KOSONG DI DOKUMEN CETAK
    // ========================================================================
    //
    // filter(Boolean) menangkap baris yang benar-benar kosong, tetapi TIDAK
    // menangkap baris yang isinya hanya &nbsp; - dan naskah yang pernah lewat
    // penyunting kerap membawanya, terutama sebagai penutup tiap blok
    // keterangan saksi. Satu baris semacam itu menjadi <p>&nbsp;</p>, lalu
    // \par tersendiri di dokumen cetak: satu baris kosong yang berdiri tanpa
    // isi antara keterangan saksi dan alinea berikutnya.
    //
    // Spasi tak-putus juga dibuang, sebab ia yang dihasilkan penyunting yang
    // sama dan lolos dari trim().
    .filter((satu) => satu.replace(/&nbsp;| /gi, "").trim().length > 0);

  // Naskah yang butirnya terlanjur mengalir dalam satu baris dipecah pada
  // penomorannya - tetapi hanya penomoran yang MENGAWALI butir, yakni yang
  // berdiri sesudah titik koma atau titik. "Pasal 19 huruf (b)" di tengah
  // kalimat tidak pernah mengawali apa pun.
  if (butir.length === 1) {
    butir = butir[0]
      .split(/(?<=[.;])\s+(?=(?:\d{1,2}|[a-z])[.)]\s)/i)
      .map((satu) => satu.trim())
      .filter(Boolean);
  }

  const aman = (satu: string) =>
    satu.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return butir.map((satu) => `<p>${aman(satu)}</p>`).join("");
}

export function susunIsianPutusanSipp(masukan: {
  naskah: string;
  pihak?: PihakPerkara[];
  jenisPerkara?: string;
  /** Keadaan draf; hanya yang sudah ditandatangani yang dianggap siap. */
  keadaanDraf?: string;
}): IsianPutusanSipp {
  const bagian = pecahNaskahPutusan(masukan.naskah || "");
  const pertimbangan = bersih(bagian.pertimbangan);
  const amar = bersih(bagian.amar);
  const jenisPerkara = bersih(masukan.jenisPerkara);
  const { teks: amarAnonim, diganti } = anonimkanAmar(amar, masukan.pihak ?? [], jenisPerkara);

  const catatan: string[] = [];
  const belumTerisi: string[] = [];

  if (!pertimbangan) belumTerisi.push("Pertimbangan hukum");
  if (!amar) belumTerisi.push("Amar putusan");

  const keadaan = bersih(masukan.keadaanDraf).toLowerCase();
  if (keadaan && keadaan !== "ditandatangani") {
    catatan.push(
      `Draf ini berkeadaan "${keadaan}", belum ditandatangani. Isinya boleh dipakai sebagai bahan, tetapi yang tersimpan di SIPP menjadi putusan resmi.`
    );
  }

  const namaPihak = diganti.filter((x) => x.menjadi !== SAMARAN_KURUNG && x.menjadi !== SAMARAN_NAMA && x.menjadi !== "(dibuang)");
  const samaran = diganti.length - namaPihak.length;
  if (amar && diganti.length === 0) {
    catatan.push(
      "Tidak satu pun nama pihak ditemukan di dalam amar, jadi amar anonim sama dengan amarnya. Periksa sendiri sebelum menyimpan."
    );
  } else if (diganti.length > 0) {
    catatan.push(
      `Amar anonim disusun dengan mengganti ${namaPihak.length} nama pihak menjadi sebutan acaranya` +
        (samaran > 0
          ? ` dan menyamarkan ${samaran} nama lain (isi kurung sesudah sebutan menjadi "${SAMARAN_KURUNG}", nama ber-bin/binti menjadi "${SAMARAN_NAMA}" - bentuk yang paling sering dipakai petugas satker)`
          : "") +
        ". Nama tanpa bin/binti di luar kurung - nama saksi, nama anak sesudah \"bernama\" - alamat, dan nomor identitas TIDAK ikut tersamar - bacalah sebelum menyimpan."
    );
  }

  // Jujur tentang Simpan: yang memakai isian ini MENEKAN Simpan sendiri.
  catatan.push(
    "Putusan otomatis MENEKAN tombol Simpan SIPP sendiri bila semua isian yang dicentang terisi dan praperiksa tidak menahan; " +
      "antrean putusan massal menekannya untuk tiap perkara yang tidak ditahan praperiksa. " +
      "Bila praperiksa menahan dan Anda memilih tetap mengisi, Simpan tidak ditekan ALETA. Periksa seluruh isian sebelum menekan Isikan."
  );

  return {
    // Pertimbangan hukum adalah rangkaian alinea "Menimbang, bahwa ..." yang
    // masing-masing berdiri sebagai satu pertimbangan tersendiri. Mengalir
    // menjadi satu blok, ia terbaca sebagai satu kalimat sepanjang delapan
    // ribu aksara - dan yang memeriksanya kehilangan batas antar alinea,
    // yakni satu-satunya tanda di mana satu pertimbangan berakhir.
    pertimbangan: paragrafButir(pertimbangan),
    // Paragraf dibentuk PALING AKHIR, sesudah nama pihak disamarkan.
    // Menyisipkan tanda HTML lebih dahulu berarti nama yang kebetulan berdiri
    // di tepi paragraf terpotong tandanya dan luput tersamar.
    amar: paragrafButir(amar),
    amarAnonim: paragrafButir(amarAnonim),
    namaDisamarkan: diganti,
    catatan,
    belumTerisi,
  };
}
