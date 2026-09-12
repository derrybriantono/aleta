import { teksDariHtml } from "@/lib/alasan-perkara-sipp";

/**
 * ============================================================================
 * DATA PERNIKAHAN PADA LAYAR INFO PERKARA AGAMA (DATA UMUM)
 * ============================================================================
 *
 * Perkara cerai - alur 15, dan itu sebagian besar perkara pengadilan agama -
 * menuntut empat isian yang seluruhnya BERTANDA BINTANG pada layar Data Umum:
 *
 *   tgl_nikah                Tanggal Menikah
 *   tgl_kutipan_akta_nikah   Tgl. Kutipan Akta Nikah
 *   no_kutipan_akta_nikah    No. Kutipan Akta Nikah
 *   ref_kua                  KUA Tempat Menikah
 *
 * Keempatnya tersimpan ke perkara_data_pernikahan, dan ketiadaannya menahan
 * penyimpanan seluruh layar. Petugas menyalinnya dari posita - yang juga ada
 * di layar itu, beberapa sentimeter di bawahnya.
 *
 * ============================================================================
 * KENAPA INI DAPAT DIPETIK, SEDANGKAN ALASAN PERKARA HANYA DAPAT DIUSULKAN
 * ============================================================================
 *
 * Alasan perkara adalah PENILAIAN: posita menyebut banyak hal dan petugas
 * memilih mana yang pokok. Data pernikahan adalah KUTIPAN: nomornya tertulis
 * apa adanya, dan menyalinnya bukan penilaian melainkan ketelitian.
 *
 * Karena itu berkas ini memetik, bukan menimbang - dan bila penanda kalimatnya
 * tidak ada, yang dipulangkan KOSONG. Tidak ada tanggal yang "kira-kira": satu
 * tanggal nikah yang salah menjadikan seluruh amar perceraian menyebut akta
 * yang tidak pernah ada.
 *
 * Bentuk kalimatnya diperiksa atas 1.200 gugatan cerai PA Donggala yang data
 * nikahnya sudah tersimpan. Bunyinya nyaris seragam:
 *
 *   "Bahwa pada tanggal 18 Juni 2020, Penggugat dan Tergugat telah
 *    melangsungkan pernikahan yang dicatat oleh Pegawai Pencatat Nikah pada
 *    Kantor Urusan Agama (KUA) Kecamatan Sindue Tobata, Kabupaten Donggala,
 *    Provinsi Sulawesi Tengah, sebagaimana sesuai dengan Kutipan Akta Nikah
 *    Nomor : 119/009/XI/2020, tertanggal 30 November 2020;"
 *
 * Hasil ukurnya ditulis di bawah tiap pemetik.
 */

export type PetikanNikah = {
  /** Tanggal dalam bentuk dd/mm/yyyy - bentuk yang diminta borang SIPP. */
  nilai: string;
  /** Kalimat posita yang menjadi asalnya, apa adanya. */
  kutipan: string;
};

export type DataNikah = {
  tglNikah: PetikanNikah | null;
  tglKutipanAktaNikah: PetikanNikah | null;
  noKutipanAktaNikah: PetikanNikah | null;
  /** Nama kecamatan KUA - untuk diperlihatkan, bukan untuk diisikan. */
  kua: PetikanNikah | null;
  /** Tempat pernikahan - dituntut permohonan itsbat nikah. */
  tempatNikah: PetikanNikah | null;
};

const BULAN: Record<string, number> = {
  januari: 1,
  februari: 2,
  pebruari: 2,
  maret: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  agustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  nopember: 11,
  desember: 12,
};

const NAMA_BULAN = Object.keys(BULAN).join("|");

/** "18 Juni 2020", "18/06/2020", "18-06-2020". */
const POLA_TANGGAL = new RegExp(
  `(\\d{1,2})\\s*(?:\\s|-|/)\\s*(${NAMA_BULAN}|\\d{1,2})\\s*(?:\\s|-|/)\\s*(\\d{4})`,
  "i"
);

function duaAngka(angka: number): string {
  return angka < 10 ? `0${angka}` : String(angka);
}

/**
 * Tanggal Indonesia menjadi dd/mm/yyyy, atau kosong bila bukan tanggal.
 *
 * Tanggalnya DIPERIKSA, bukan sekadar dipotong: "31 April 2020" lolos pola
 * tetapi bukan tanggal, dan yang tersimpan darinya adalah 1 Mei - satu hari
 * yang tidak pernah tertulis di akta mana pun.
 */
export function tanggalKeBorang(teks: string): string {
  const cocok = POLA_TANGGAL.exec(String(teks ?? ""));
  if (!cocok) return "";

  const hari = Number.parseInt(cocok[1], 10);
  const bagianBulan = String(cocok[2]).toLowerCase();
  const bulan = BULAN[bagianBulan] ?? Number.parseInt(bagianBulan, 10);
  const tahun = Number.parseInt(cocok[3], 10);

  if (!Number.isFinite(hari) || !Number.isFinite(bulan) || !Number.isFinite(tahun)) return "";
  if (bulan < 1 || bulan > 12 || hari < 1 || hari > 31) return "";
  if (tahun < 1900 || tahun > 2200) return "";

  const uji = new Date(Date.UTC(tahun, bulan - 1, hari));
  if (
    uji.getUTCFullYear() !== tahun ||
    uji.getUTCMonth() !== bulan - 1 ||
    uji.getUTCDate() !== hari
  ) {
    return "";
  }

  return `${duaAngka(hari)}/${duaAngka(bulan)}/${tahun}`;
}

/** Naskah dipecah menjadi kalimat, sama seperti pada pengusul pilihan. */
function pecahKalimat(teks: string): string[] {
  return String(teks ?? "")
    .split(/(?<=[.;:])\s+|\n+/)
    .map((satu) => satu.trim())
    .filter(Boolean);
}

function pangkas(kalimat: string): string {
  return kalimat.length > 300 ? `${kalimat.slice(0, 300)}…` : kalimat;
}

/**
 * Merapikan potongan nama tempat.
 *
 * Posita SIPP kerap memuat huruf pengganti - sisa penyalinan dari pengolah
 * kata - tepat di tengah nama desa: "Desa<U+FFFD> Kotarindau". Membiarkannya berarti
 * yang terisi ke borang memuat huruf yang tidak dapat dicari siapa pun.
 */
function bersihkan(teks: string): string {
  return String(teks ?? "")
    // Huruf pengganti (U+FFFD), spasi tanpa putus, spasi nol lebar, dan
    // huruf kendali - seluruhnya menjadi spasi biasa lebih dahulu.
    .replace(/[\uFFFD\u00A0\u200B-\u200D\uFEFF]/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Nomor kutipan akta nikah.
 *
 * Dua bentuk hidup berdampingan di berkas yang sama: yang lama bertingkat
 * ("119/009/XI/2020", "27/9/II/2004") dan yang baru enam belas angka
 * ("7203081082024015"). Keduanya diterima apa adanya; yang TIDAK diterima
 * adalah sesuatu yang tidak memuat satu pun angka.
 *
 * Kata "Duplikat" di depannya - dipakai bila kutipan aslinya hilang - TIDAK
 * ikut dipetik. Diperiksa atas 1.200 gugatan: petugas menyimpan nomornya saja
 * pada hampir seluruhnya, dan hanya sesekali menuliskan "Duplikat" di
 * depannya. Yang dipetik adalah kebiasaan yang berlaku, dan yang sesekali itu
 * ditambahkan sendiri oleh petugas - satu kata, sesudah ia melihat kalimatnya.
 *
 * Pemisah antar bagiannya tidak selalu garis miring: ada yang menulis
 * "0437 012 XII 2020" dan "82/ I/ XI/ 1992". Karena itu yang menentukan akhir
 * nomornya bukan spasi melainkan TANDA BACA atau kata berikutnya -
 * "tertanggal", "tanggal", "yang". Berhenti pada spasi pertama memulangkan
 * "0437", dan nomor sepotong itu tampak berhasil.
 */
function petikNomorAkta(jendela: string): string {
  const cocok =
    /kutipan\s+akta\s+nikah\s*(?:nomor|nomer|no\.?)?\s*[:.]?\s*([0-9][0-9A-Za-z./\- ]{2,50}?)\s*(?=[,;)]|\.\s|$|\s+(?:ter)?tanggal\b|\s+tgl\b|\s+yang\b|\s+sebagaimana\b|\s+dikeluarkan\b|\s+diterbitkan\b|\s+tertulis\b|\s+atas\b|\s+dari\b|\s+oleh\b|\s+dan\b|\s+serta\b|\s+tertera\b)/i.exec(
      jendela
    );
  if (!cocok) return "";

  const nomor = String(cocok[1]).replace(/[\s.,;:]+$/, "").trim();
  if (!/\d/.test(nomor) || nomor.length < 3) return "";
  return nomor;
}

/**
 * Tanggal kutipan akta - tanggal yang mengikuti NOMORNYA, bukan tanggal mana
 * pun di kalimat itu.
 *
 * Kalimat yang sama memuat tanggal pernikahan di awalnya. Mencari "tanggal"
 * pertama pada kalimat itu memulangkan tanggal nikah, dan keduanya kerap
 * berbeda beberapa bulan.
 */
function petikTanggalKutipan(jendela: string, nomor: string): string {
  if (!nomor) return "";
  const posisi = jendela.indexOf(nomor);
  if (posisi < 0) return "";

  const ekor = jendela.slice(posisi + nomor.length);
  const cocok = new RegExp(
    `(?:tertanggal|tanggal|tgl\\.?)\\s*[:]?\\s*(\\d{1,2}\\s*(?:\\s|-|/)\\s*(?:${NAMA_BULAN}|\\d{1,2})\\s*(?:\\s|-|/)\\s*\\d{4})`,
    "i"
  ).exec(ekor);
  if (!cocok) return "";

  return tanggalKeBorang(cocok[1]);
}

/**
 * Tanggal pernikahan.
 *
 * Penanda yang dituntut: kalimatnya harus benar-benar berbicara tentang
 * berlangsungnya pernikahan. Posita memuat banyak tanggal - pisah rumah,
 * puncak pertengkaran, kelahiran anak - dan tanggal yang salah di sini
 * melahirkan akta cerai yang menyebut pernikahan yang tidak pernah ada.
 */
function petikTanggalNikah(kalimat: string[]): PetikanNikah | null {
  const pola = [
    // Gugatan cerai: "Bahwa pada tanggal 18 Juni 2020, Penggugat dan Tergugat
    // telah melangsungkan pernikahan..."
    //
    // Permohonan itsbat: "Bahwa pada hari Jum'at, 14 Agustus 2020 Pemohon I
    // dan Pemohon II melangsungkan pernikahan menurut agama Islam..." - hari
    // disebut lebih dahulu dan kata "tanggal" tidak ada sama sekali.
    /pada\s+(?:hari\s+[^,]{3,25},?\s*)?(?:tanggal\s+)?(\d{1,2}[^,;]{3,30}\d{4})[^.;]{0,160}?(?:melangsungkan|melaksanakan|melakukan)\s+(?:pernikahan|perkawinan|akad)/i,
    // "...menikah pada tanggal 18 Juni 2020..."
    /(?:menikah|pernikahan|perkawinan)\s+(?:tersebut\s+)?(?:dilangsungkan\s+|dilaksanakan\s+)?pada\s+(?:hari\s+[^,]{3,25},?\s*)?(?:tanggal\s+)?(\d{1,2}[^,;]{3,30}\d{4})/i,
  ];

  for (const satu of kalimat) {
    // Kalimat itu harus berbicara tentang pernikahannya sendiri.
    if (!/(menikah|pernikahan|perkawinan|akad\s+nikah)/i.test(satu)) continue;
    for (const p of pola) {
      const cocok = p.exec(satu);
      if (!cocok) continue;
      const nilai = tanggalKeBorang(cocok[1]);
      if (nilai) return { nilai, kutipan: pangkas(satu) };
    }
  }

  return null;
}

/**
 * Nama kecamatan KUA tempat menikah.
 *
 * Dipetik untuk DIPERLIHATKAN saja. Medan KUA pada borang SIPP adalah daftar
 * yang dicari ke peladen ketika petugas mengetik, dan pilihannya tidak ada di
 * halaman sebelum ia mengetik - jadi tidak ada yang dapat diisikan tanpa
 * menebak kodenya. Yang berguna tetap ada: petugas tahu apa yang harus
 * diketikkan tanpa menggulung ke positanya.
 *
 * "Kecamatan" yang tertulis dua kali - ada di berkas sungguhan - dilewati.
 */
function petikKua(kalimat: string[]): PetikanNikah | null {
  for (const satu of kalimat) {
    const cocok =
      /kantor\s+urusan\s+agama\s*(?:\(\s*kua\s*\))?\s*(?:kecamatan\s+)*([A-Za-z][A-Za-z' .-]{2,40}?)\s*(?:,|\s+kabupaten|\s+kota\b|\s+provinsi)/i.exec(
        satu
      );
    if (!cocok) continue;
    const nama = String(cocok[1]).replace(/\s+/g, " ").trim();
    if (!nama) continue;
    return { nilai: nama, kutipan: pangkas(satu) };
  }
  return null;
}

/**
 * Tempat berlangsungnya pernikahan - dituntut permohonan itsbat nikah.
 *
 * Bunyinya "...melangsungkan pernikahan menurut agama Islam, bertempat di Desa
 * Kotarindau, di wilayah hukum Kantor Urusan Agama Kecamatan Dolo Tengah...".
 *
 * Yang dipetik DESA-nya, sebab itulah tempat pernikahannya; kecamatan
 * sesudahnya adalah wilayah hukum KUA. Sebagian petugas memang menyimpan
 * kecamatan beserta kabupaten dan provinsinya - diukur atas 115 permohonan,
 * keduanya sama-sama terpakai - jadi yang dipetik di sini diperlihatkan
 * beserta kalimatnya dan dapat disunting sebelum diisikan.
 */
function petikTempatNikah(kalimat: string[]): PetikanNikah | null {
  for (const satu of kalimat) {
    if (!/(menikah|pernikahan|perkawinan)/i.test(satu)) continue;
    const cocok = /bertempat\s+di\s+([^,;.]{3,60})/i.exec(satu);
    if (!cocok) continue;
    const tempat = bersihkan(cocok[1]);
    if (!tempat) continue;
    return { nilai: tempat, kutipan: pangkas(satu) };
  }
  return null;
}

/**
 * Memetik data pernikahan dari posita.
 *
 * Menerima HTML CKEditor apa adanya - yang membersihkannya berkas ini sendiri,
 * supaya pemanggilnya tidak perlu tahu bahwa positanya HTML.
 */
export function petikDataNikah(posita: string): DataNikah {
  const teks = teksDariHtml(posita ?? "");
  const kalimat = pecahKalimat(teks);

  // ────────────────────────────────────────────────────────────────────────
  // NOMOR AKTA DICARI PADA JENDELA TEKS, BUKAN PADA SATU KALIMAT
  // ────────────────────────────────────────────────────────────────────────
  //
  // Bunyinya "Kutipan Akta Nikah Nomor : 119/009/XI/2020, tertanggal 30
  // November 2020" - dan titik dua itu memisahkan kalimat menurut pemecah
  // yang sama yang dipakai di tempat lain. Dicari per kalimat, nomornya
  // selalu jatuh ke potongan berikutnya dan tidak pernah tertemukan: dari
  // 1.200 gugatan, hanya 22 yang terpetik. Jendela teks tidak punya masalah
  // itu, dan panjangnya cukup untuk memuat nomor beserta tanggalnya.
  const posisiAkta = teks.search(/kutipan\s+akta\s+nikah/i);
  const jendela = posisiAkta >= 0 ? teks.slice(posisiAkta, posisiAkta + 260) : "";
  const nomor = petikNomorAkta(jendela);
  const tanggalKutipan = petikTanggalKutipan(jendela, nomor);
  const kutipanAkta = pangkas(jendela);

  return {
    tglNikah: petikTanggalNikah(kalimat),
    tglKutipanAktaNikah: tanggalKutipan ? { nilai: tanggalKutipan, kutipan: kutipanAkta } : null,
    noKutipanAktaNikah: nomor ? { nilai: nomor, kutipan: kutipanAkta } : null,
    kua: petikKua(kalimat),
    tempatNikah: petikTempatNikah(kalimat),
  };
}
